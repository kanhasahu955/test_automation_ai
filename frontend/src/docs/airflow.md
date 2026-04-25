# Airflow (optional)

Airflow is **opt-in** — the main `docker-compose.yml` does NOT include it,
so you only run it when you need orchestrated, long-running workloads:

- Scheduled STM validations across many sources.
- Data profiling + drift detection on production datasets.
- Bulk regeneration of AI test scaffolds.
- Multi-step quality pipelines (extract → profile → validate → report).

Short, latency-sensitive work stays in **Celery** (separate page).

## When to use Airflow vs Celery

| Need                                | Use         |
|-------------------------------------|-------------|
| Send a notification, run one test   | Celery      |
| Compute one metric on demand        | Celery      |
| Cron-style maintenance              | Celery beat |
| Multi-step DAG with dependencies    | Airflow     |
| Scheduled pipelines, backfills      | Airflow     |
| Cross-system orchestration          | Airflow     |

## Layout

DAG sources live in the backend repo so they can import service classes:

```text
backend/app/airflow_dags/        # DAG definitions
```

The Airflow runtime itself is **not** committed — bring your own. The
recommended path is the official Airflow image with our DAG folder mounted in.

## Local setup (docker compose, ad-hoc)

Create `docker-compose.airflow.yml` next to the main compose file:

```yaml
version: "3.9"

x-airflow-common: &airflow-common
  image: apache/airflow:2.10.2
  environment:
    AIRFLOW__CORE__EXECUTOR: LocalExecutor
    AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@airflow-db:5432/airflow
    AIRFLOW__CORE__LOAD_EXAMPLES: "false"
  volumes:
    - ./backend/app/airflow_dags:/opt/airflow/dags
    - airflow_logs:/opt/airflow/logs
  networks: [qf_net]

services:
  airflow-db:
    image: postgres:15
    environment:
      POSTGRES_USER: airflow
      POSTGRES_PASSWORD: airflow
      POSTGRES_DB: airflow
    volumes: [airflow_pg:/var/lib/postgresql/data]
    networks: [qf_net]

  airflow-init:
    <<: *airflow-common
    entrypoint: /bin/bash
    command:
      - -c
      - |
        airflow db migrate &&
        airflow users create --username admin --password admin \
          --firstname Admin --lastname User --role Admin --email admin@qf.local
    depends_on: [airflow-db]

  airflow-webserver:
    <<: *airflow-common
    command: webserver
    ports: ["8088:8080"]
    depends_on: [airflow-init]

  airflow-scheduler:
    <<: *airflow-common
    command: scheduler
    depends_on: [airflow-init]

volumes:
  airflow_pg:
  airflow_logs:

networks:
  qf_net:
    external: true   # reuse the same network as the main stack
```

Then:

```bash
docker compose -f docker-compose.airflow.yml up -d airflow-init   # one-time
docker compose -f docker-compose.airflow.yml up -d
open http://localhost:8088   # admin / admin
```

> Make sure `make up` was run first so the `qf_net` network exists.

## Authoring a DAG

```python
# backend/app/airflow_dags/quality_pipeline.py
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

from app.modules.profiling.service import ProfilingService
from app.modules.stm.service import StmService
from app.modules.reports.service import ReportService

default_args = {"retries": 2, "retry_delay": timedelta(minutes=5)}

with DAG(
    dag_id="qf_daily_quality",
    start_date=datetime(2025, 1, 1),
    schedule="0 2 * * *",
    catchup=False,
    default_args=default_args,
    tags=["qualityforge"],
) as dag:
    profile = PythonOperator(task_id="profile",  python_callable=ProfilingService().run_daily)
    stm     = PythonOperator(task_id="stm",      python_callable=StmService().validate_all)
    report  = PythonOperator(task_id="report",   python_callable=ReportService().publish_daily)

    profile >> stm >> report
```

> DAGs import the same service classes the API uses. That's why our backend
> is a modular monolith — services are reusable everywhere.

## Connections & variables

Use the Airflow UI **Admin → Connections** to register:

| Conn ID            | Type   | Used for                         |
|--------------------|--------|----------------------------------|
| `qf_mysql`         | MySQL  | Source/target databases          |
| `qf_redis`         | Redis  | Cache lookups                    |
| `qf_api`           | HTTP   | Calling the QualityForge API     |

…and **Variables** for tunables like `qf_batch_size`, `qf_environment`.

## Production tips

- Run the **CeleryExecutor** or **KubernetesExecutor** so workers scale
  independently from the scheduler.
- Pin DAG-only requirements in `ops/airflow/requirements.txt`. Don't pull
  the full backend dependency tree into the scheduler.
- Use `pool_slots` to throttle DAGs that hit the same data source.
- Send DAG run results back to QualityForge with the `qf_api` connection so
  they show up in the **Reports** screen.

## Troubleshooting

- **DAG not appearing** → Airflow scans every 30s. Tail logs and look for
  `Failed to import:` errors:

  ```bash
  docker compose -f docker-compose.airflow.yml logs -f airflow-scheduler
  ```

- **Scheduler heartbeat stale** → check `airflow-scheduler` container
  resources or restart it.
- **DB lock errors** → make sure the metadata DB is Postgres (the example
  above uses Postgres). SQLite is single-writer and breaks with concurrency.
