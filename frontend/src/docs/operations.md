# Operations Console

The **Operations Console** (sidebar → *Operations → Ops Console*, route `/operations`) is the one place to verify that every moving part of QualityForge AI is healthy.

It refreshes automatically every 10 seconds and is **safe to load even when nothing is running** — each component degrades gracefully and tells you exactly which `make` target to run to fix it.

## What you see

| Card | What it checks |
| --- | --- |
| **API Service** | The FastAPI app itself, plus links to Swagger and ReDoc. |
| **MySQL** | Runs `SELECT 1` and reports latency + DSN. |
| **Redis** | `PING`, memory, connected clients, key counts per DB and the RedBeat schedule keys. |
| **Celery** | Worker roster (active / processed counts), queues, and the full registered-task list. |
| **External dashboards** | Reachability of Flower, Redis Commander and Airflow with one-click *Open UI* buttons. |

The top status pill turns **green / amber / red** based on the worst component, so a glance tells you the platform's health.

## Starting the dashboards locally

> All targets ship in the project `Makefile`. Run `make help` to discover more.

### Celery + Flower

```bash
# Native (uv) — fastest dev loop
make worker          # one terminal
make beat            # another terminal (only if you use schedules)
make flower          # http://localhost:5555

# OR Docker — closer to production
make up              # brings up worker + beat + redis
make flower-docker   # adds Flower under the same compose project
```

Flower shows live broker activity, retries, task tracebacks and worker
heartbeats. The Operations Console embeds a status badge that turns green
once Flower responds.

### Redis + Redis Commander

```bash
make up              # starts Redis on :6379
make redis-ui        # Redis Commander on http://localhost:8081
                     #   default credentials: admin / admin
```

Redis Commander pre-configures three connections that map to QualityForge's
Redis databases:

| Connection | DB | Used for |
| --- | --- | --- |
| `cache` | 0 | Application cache (`REDIS_URL`) |
| `broker` | 1 | Celery broker (`CELERY_BROKER_URL`) — RedBeat keys live under `qf:redbeat:*` |
| `results` | 2 | Celery result backend (`CELERY_RESULT_BACKEND`) |

CLI alternative: `make redis-cli`.

### Airflow (optional)

Airflow is **only needed** if you want to use the bundled DAGs in
`backend/app/airflow_dags/` (regression, data-quality, STM-validation).

```bash
make airflow-up      # http://localhost:8088   (admin / admin)
make airflow-logs    # tail the standalone container
make airflow-down
```

The container mounts `backend/app/airflow_dags/` read-only, so any changes
you make to a DAG show up after the scheduler picks them up (≤30s).

## Configuring the URLs

Each external UI URL lives in `backend/.env` and is wired through Pydantic
settings:

```env
FLOWER_URL=http://localhost:5555
REDIS_COMMANDER_URL=http://localhost:8081
AIRFLOW_URL=http://localhost:8088
```

Change them when you're behind a reverse proxy or running in staging — the
Operations Console will pick the new URLs up on the next refresh.

## API endpoints

Everything the page renders is also exposed for scripts and CI:

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/ops/snapshot` | Single payload that drives the whole page. |
| `GET` | `/api/v1/ops/database` | `SELECT 1` health + latency. |
| `GET` | `/api/v1/ops/redis` | `PING`, memory, key counts, RedBeat keys. |
| `GET` | `/api/v1/ops/celery` | Workers, queues, registered tasks. |
| `GET` | `/api/v1/ops/links` | Reachability of Flower / Redis Commander / Airflow. |

All endpoints require a valid auth token (same as the rest of the app).

## Quick troubleshooting

- **Celery card shows "no workers"** — start `make worker` (or `make up`).
- **Redis card down** — make sure `redis-server` is running on the port
  configured in `REDIS_URL`. Inside Docker, the hostname must be `redis`.
- **Flower / Redis Commander unreachable** — start them with
  `make ops-up`. They run under the compose `ops` profile so they don't
  consume resources unless you ask for them.
- **Airflow unreachable** — Airflow is opt-in. Start it with
  `make airflow-up` if you actually need it; otherwise the badge can stay
  grey (we treat it as informational only).
