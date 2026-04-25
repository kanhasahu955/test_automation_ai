# Configuration

QualityForge AI uses a **three-layer configuration system**:

1. **`backend/config/base.yaml`** — shared, non-secret defaults.
2. **`backend/config/{APP_ENV}.yaml`** — per-environment overrides.
3. **`backend/.env` + process env vars** — secrets and machine-specific values.

Precedence (first wins): `env var → .env → {APP_ENV}.yaml → base.yaml → field defaults`.

## Switching environments

Pick the overlay by setting `APP_ENV`:

```bash
APP_ENV=development uvicorn app.main:asgi_app --reload   # default
APP_ENV=staging     uvicorn app.main:asgi_app
APP_ENV=production  uvicorn app.main:asgi_app
APP_ENV=test        pytest
```

> `asgi_app` wraps the FastAPI app with Socket.IO middleware so HTTP and
> WebSocket share the same port. Tests still import `app` from `app.main`
> directly — that's the raw FastAPI symbol, used by `TestClient`.

Override the config directory entirely (e.g. for tests or CI):

```bash
QF_CONFIG_DIR=/etc/qualityforge/config uvicorn app.main:asgi_app
```

## YAML key map

YAML keys are mapped to Pydantic Settings env-style keys by `config_loader.py`.
Examples:

| YAML path                  | Settings key            |
|----------------------------|-------------------------|
| `app.name`                 | `APP_NAME`              |
| `app.env`                  | `APP_ENV`               |
| `app.host` / `app.port`    | `APP_HOST` / `APP_PORT` |
| `app.api_prefix`           | `API_PREFIX`            |
| `app.cors_origins`         | `CORS_ORIGINS`          |
| `database.pool_size`       | `DB_POOL_SIZE`          |
| `database.max_overflow`    | `DB_MAX_OVERFLOW`       |
| `database.connect_timeout_s` | `DB_CONNECT_TIMEOUT_S`|
| `redis.url`                | `REDIS_URL`             |
| `celery.broker_url`        | `CELERY_BROKER_URL`     |
| `celery.result_backend`    | `CELERY_RESULT_BACKEND` |
| `ai.enabled`               | `AI_ENABLED`            |
| `worker.concurrency`       | `WORKER_CONCURRENCY`    |

To override any of these, set the **`Settings` key** as an environment variable —
that always wins.

## Secrets — what goes where

| Item                | Lives in            | Why                          |
|---------------------|---------------------|------------------------------|
| `DB_PASSWORD`       | `.env` / secret mgr | Never commit                 |
| `JWT_SECRET`        | `.env` / secret mgr | Never commit                 |
| `OPENAI_API_KEY`    | `.env` / secret mgr | Never commit                 |
| `APP_NAME`, `port`  | `base.yaml`         | Non-secret, shared default   |
| `pool_size`         | `{env}.yaml`        | Tuned per environment        |

> The repo ships `backend/.env.example` with **redacted placeholders only**.
> If you ever paste real keys there by accident, rotate them immediately.

## Example: tuning the database pool for production

```yaml
# backend/config/production.yaml
database:
  pool_size: 40
  max_overflow: 60
  connect_timeout_s: 5
```

…then deploy with `APP_ENV=production` set in your environment manager.

## Verifying your configuration

```bash
make backend-shell                                    # opens a Python REPL inside the uv env
# or, in any backend terminal:
cd backend && uv run python -c \
  "from app.core.config import settings; print(settings.model_dump())"
```

Or add `?debug=1` query param to any of the diagnostic endpoints (only enabled
when `APP_DEBUG=true`).
