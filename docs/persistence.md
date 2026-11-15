# Persistence Architecture



kshemOS supports configurable persistence backends for incident management, reports, and fraud-graph relationships.



## 1. Supported Backends



| Component | Development | Production |

|---|---|---|

| Incidents | In-memory | PostgreSQL |

| Reports | In-memory | PostgreSQL |

| Fraud graph | NetworkX | Neo4j |



The default configuration uses in-memory storage and NetworkX, so developers can run the application without database servers.



## 2. PostgreSQL Configuration



Install PostgreSQL and create a database named `kshemos`.



Configure these environment variables:



```env

PERSISTENCE_BACKEND=postgres

DATABASE_URL=postgresql+psycopg://USERNAME:PASSWORD@localhost:5432/kshemos

```



Replace `USERNAME` and `PASSWORD` with your database credentials.



### Run database migrations



Open a terminal in the `backend` directory and activate the virtual environment:



```powershell

.\venv\Scripts\Activate.ps1

```



Apply the migrations:



```powershell

python -m alembic upgrade head

```



Check the current migration:



```powershell

python -m alembic current

```

### Offline sync ledger

Migration `0002_sync_operations` adds the `sync_operations` table used to make
offline retries idempotent. It stores the original result for each
`(subject, operation_id)` pair so a replayed queued change does not mutate an
incident twice. See `docs/offline-sync.md`.



## 3. Neo4j Configuration



Install and start a Neo4j database.



Configure:



```env

GRAPH_BACKEND=neo4j

NEO4J_URI=bolt://localhost:7687

NEO4J_USERNAME=neo4j

NEO4J_PASSWORD=YOUR_PASSWORD

NEO4J_DATABASE=neo4j

```



The application uses the Neo4j adapter for persistent account and relationship storage.



## 4. Development Configuration



For local development, use:



```env

PERSISTENCE_BACKEND=memory

GRAPH_BACKEND=networkx

```



No external database server is required in this configuration.



## 5. Synthetic Seed Data



The fraud graph uses deterministic synthetic demo data defined in:



`backend/app/data/seed_graph.py`



The seed data contains synthetic accounts, flagged accounts, known mule accounts, and relationships.



It must not be treated as real citizen or financial data.



## 6. Data Migration Considerations



Earlier in-memory stores held data only in application memory.



To move to PostgreSQL:



1. Provision a PostgreSQL database.

2. Configure `PERSISTENCE_BACKEND=postgres`.

3. Set `DATABASE_URL` securely.

4. Apply the Alembic migrations.

5. Restart the application using the PostgreSQL configuration.



Changing the backend does not automatically transfer records from an existing in-memory process. Export and import existing records separately if they need to be retained.



For graph persistence, configure Neo4j and set the corresponding environment variables.



## 7. Security



- Never commit database passwords or credentials.

- Keep environment files out of version control.

- Use environment variables or a secrets manager.

- Use synthetic data for development and automated tests.

- Restrict production database access to authorized services.


