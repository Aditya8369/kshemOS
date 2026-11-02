import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/api/officer/response-teams",
    tags=["Response Team Assignment"]
)

# Store the database inside the backend directory.
DB_PATH = Path(__file__).resolve().parents[2] / "response_teams.db"

# Sample teams used for initial database setup.
INITIAL_TEAMS = [
    (1, "Cyber Response Alpha", "Cyber Fraud", "Delhi", 4, 6, "INC-101"),
    (2, "Investigation Unit", "Investigation", "Mumbai", 5, 5, "INC-102"),
    (3, "Digital Forensics", "Digital Forensics", "Delhi", 2, 5, "INC-103"),
    (4, "Fraud Monitoring", "Financial Fraud", "Bangalore", 7, 5, "INC-104"),
]


class ReassignmentRequest(BaseModel):
    incident: str = Field(min_length=1, max_length=50)
    reason: str = Field(min_length=1, max_length=500)


def get_connection():
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS response_teams (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                specialty TEXT NOT NULL,
                jurisdiction TEXT NOT NULL,
                assigned INTEGER NOT NULL,
                capacity INTEGER NOT NULL,
                incident TEXT NOT NULL
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS assignment_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_id INTEGER NOT NULL,
                team TEXT NOT NULL,
                previous_incident TEXT NOT NULL,
                new_incident TEXT NOT NULL,
                reason TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (team_id) REFERENCES response_teams(id)
            )
        """)

        # Insert sample teams only if they don't already exist.
        connection.executemany("""
            INSERT OR IGNORE INTO response_teams
            (id, name, specialty, jurisdiction, assigned, capacity, incident)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, INITIAL_TEAMS)


def get_coverage_status(team):
    if team["assigned"] > team["capacity"]:
        return "Overstretched"

    if team["assigned"] == team["capacity"]:
        return "Limited"

    return "Available"


def serialize_team(row):
    team = dict(row)
    team["status"] = get_coverage_status(team)
    return team


def serialize_history(row):
    return {
        "id": row["id"],
        "team_id": row["team_id"],
        "team": row["team"],
        "from": row["previous_incident"],
        "to": row["new_incident"],
        "reason": row["reason"],
        "time": row["timestamp"],
    }


# Create tables and seed demo teams when the module is imported.
initialize_database()


@router.get("")
def list_response_teams():
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT *
            FROM response_teams
            ORDER BY id
        """).fetchall()

    return [serialize_team(row) for row in rows]


@router.get("/history")
def assignment_history():
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT *
            FROM assignment_history
            ORDER BY id DESC
        """).fetchall()

    return [serialize_history(row) for row in rows]


@router.put("/{team_id}/reassign")
def reassign_team(team_id: int, payload: ReassignmentRequest):
    incident = payload.incident.strip()
    reason = payload.reason.strip()

    if not incident or not reason:
        raise HTTPException(
            status_code=422,
            detail="Incident ID and reason are required"
        )

    with get_connection() as connection:
        # BEGIN IMMEDIATE prevents simultaneous writes from
        # modifying the same assignment unexpectedly.
        connection.execute("BEGIN IMMEDIATE")

        row = connection.execute("""
            SELECT *
            FROM response_teams
            WHERE id = ?
        """, (team_id,)).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Team not found"
            )

        team = dict(row)

        if team["incident"] == incident:
            raise HTTPException(
                status_code=400,
                detail="Team is already assigned to this incident"
            )

        previous_incident = team["incident"]
        timestamp = datetime.now(timezone.utc).isoformat()

        connection.execute("""
            UPDATE response_teams
            SET incident = ?
            WHERE id = ?
        """, (incident, team_id))

        cursor = connection.execute("""
            INSERT INTO assignment_history
            (
                team_id,
                team,
                previous_incident,
                new_incident,
                reason,
                timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            team_id,
            team["name"],
            previous_incident,
            incident,
            reason,
            timestamp,
        ))

        history_entry = {
            "id": cursor.lastrowid,
            "team_id": team_id,
            "team": team["name"],
            "from": previous_incident,
            "to": incident,
            "reason": reason,
            "time": timestamp,
        }

        team["incident"] = incident

    return {
        "team": {
            **team,
            "status": get_coverage_status(team)
        },
        "history_entry": history_entry,
    }