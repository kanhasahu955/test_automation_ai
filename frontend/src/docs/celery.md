# Celery

Celery handles **short-lived async work** in QualityForge — sending
notifications, kicking off test runs, computing report metrics, AI prompt
streaming buffers, etc. Long-running ETL belongs in **Airflow** (separate page).

## Topology

```text
       FastAPI            Redis (broker)            Celery worker(s)
   ┌──────────────┐   ┌──────────────────┐       ┌────────────────┐
   │  service.py  │──►│  qf:celery:default│ ────► │  task handler  │
   └──────────────┘   └──────────────────┘       └────────────────┘
          ▲                       │                       │
          │                  result backend (Redis)       │
          └────────────────────────────────────────────────┘
```

Broker + result backend = **Redis** by default. Easy to swap to RabbitMQ /
Postgres later without changing task code.

## Configuration (YAML)

```yaml
# backend/config/base.yaml
celery:
  broker_url: "redis://redis:6379/1"
  result_backend: "redis://redis:6379/2"
  task_default_queue: "default"
  task_acks_late: true
  worker_prefetch_multiplier: 1

worker:
  concurrency: 4
  max_tasks_per_child: 100
  max_memory_per_child_kb: 250000   # 250MB
```

Override per environment in `production.yaml`:

```yaml
worker:
  concurrency: 16
  max_tasks_per_child: 500
```

## Running locally

```bash
make worker         # starts: celery -A app.celery_app worker -l info
make beat           # starts: celery -A app.celery_app beat -l info  (cron-like jobs)
make flower         # optional: Flower UI on http://localhost:5555
```

Inside Docker the worker and beat services come up automatically with
`make up`. Verify:

```bash
make logs svc=worker
make exec svc=worker
# inside the container:
celery -A app.celery_app inspect ping
celery -A app.celery_app inspect active
```

## Defining a task

```python
# backend/app/modules/executions/tasks.py
from app.celery_app import celery_app
from app.modules.executions.service import ExecutionService

@celery_app.task(name="executions.run_test_case", bind=True, max_retries=3)
def run_test_case(self, execution_id: str) -> dict:
    return ExecutionService().run(execution_id)
```

Enqueue from a service:

```python
from app.modules.executions.tasks import run_test_case

run_test_case.delay(str(execution.id))
```

## In Docker

The bundled `docker-compose.yml` already declares both services — they reuse
the backend image and just override the entrypoint command:

```yaml
worker:
  image: qualityforge/backend:latest
  command: celery -A app.celery_app worker -l info -Q default --concurrency=4
  env_file: ./backend/.env
  depends_on: [redis, mysql]

beat:
  image: qualityforge/backend:latest
  command: celery -A app.celery_app beat -l info
  env_file: ./backend/.env
  depends_on: [redis]
```

`make up` brings the full stack — MySQL, Redis, API, worker, beat, frontend,
and Nginx — online.

## Production tips

- **One queue per workload class** — e.g. `default`, `ai`, `reports`.
  Run dedicated worker pools so noisy AI jobs don't starve fast queues.
- **`acks_late = True` + `prefetch = 1`** for at-least-once semantics on
  important tasks (already on by default in `base.yaml`).
- **Idempotency** — design tasks so retrying is safe. Use unique keys.
- **Dead-letter queue** — exceptions bubble to a `failed` queue with the
  exception type / traceback in the result backend.
- **Monitoring** — point Flower or any Prometheus exporter at the broker.

```bash
celery -A app.celery_app flower --port=5555
```

## Beat / scheduled tasks

Add periodic jobs in `app/celery_app.py`:

```python
celery_app.conf.beat_schedule = {
  "refresh-quality-metrics": {
    "task": "quality.refresh_metrics",
    "schedule": 60.0,   # every minute
  },
}
```

For anything more complex (DAGs, dependencies, backfills) prefer **Airflow** — see the next page.
