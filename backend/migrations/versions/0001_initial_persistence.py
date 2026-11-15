"""Create initial persistence tables.

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-11
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Reports
    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )

    # Incidents
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("report_id", sa.String(length=64), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("opened_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
    )

    op.create_index(
        "ix_incidents_report_id",
        "incidents",
        ["report_id"],
    )

    # ID counters
    op.create_table(
        "id_counters",
        sa.Column("name", sa.String(length=64), primary_key=True),
        sa.Column(
            "value",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # Regional staffing
    op.create_table(
        "staffing",
        sa.Column("region", sa.String(length=100), primary_key=True),
        sa.Column(
            "officers_on_duty",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade():
    op.drop_table("staffing")
    op.drop_table("id_counters")

    op.drop_index(
        "ix_incidents_report_id",
        table_name="incidents",
    )
    op.drop_table("incidents")

    op.drop_table("reports")