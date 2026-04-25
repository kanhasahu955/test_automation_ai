# Troubleshooting

A curated set of fixes for the issues teams hit most often.

## Backend won't start

### `pydantic_core._pydantic_core.ValidationError: JWT_SECRET`

You forgot to set `JWT_SECRET` in `backend/.env`. Generate one:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### `OperationalError: (2003, "Can't connect to MySQL server")`

Either MySQL is not up or `DB_HOST`/`DB_PORT` is wrong.

```bash
docker compose up -d mysql
make ps
```

### `Library stubs not installed for "yaml"`

Add `types-PyYAML` to dev deps and re-sync:

```bash
cd backend
uv add --group dev types-PyYAML
make backend-typecheck
```

### `SqlTemplateNotFound: stm/null_check`

The renderer prefixes templates with `templates/stm/`. Make sure:

- the file exists at `backend/sql/templates/stm/null_check.sql`,
- you call `sql_loader.load("templates/stm/null_check")` (no `.sql` suffix).

## Frontend won't start

### `npm error ENOENT ... package.json`

You ran `npm` outside `frontend/`. Use:

```bash
cd frontend && npm run dev
```

…or run via `make frontend-dev`.

### `vite` proxy returns 502

The backend isn't running or `VITE_API_URL` is wrong. Check `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000/api/v1
```

### `Module not found: Can't resolve 'framer-motion'`

Re-install with the legacy peer flag (npm 10 + ESLint 9 conflict):

```bash
cd frontend
npm install --legacy-peer-deps
```

## Auth issues

### Login works, then 401 a minute later

Refresh-token rotation is broken. Common causes:

1. The refresh endpoint is rate-limited too aggressively.
2. Reverse proxy (Nginx) is stripping cookies. Add:
   ```nginx
   proxy_pass_request_headers on;
   ```

### `JWT_SECRET` rotated → all users signed out

By design. To rotate without forcing re-login, support a list of valid
secrets and roll the old one out gradually.

## Workers / async

### Celery worker idle but tasks queued

```bash
celery -A app.celery_app inspect active
```

If the worker is busy: increase `worker.concurrency` in `production.yaml`.
If empty: confirm `CELERY_BROKER_URL` matches between API and worker.

### Airflow scheduler shows DAG but tasks queued forever

Almost always a pool / executor mismatch. Run:

```bash
docker compose -f docker-compose.airflow.yml exec airflow-scheduler airflow info
```

…and confirm the executor (`LocalExecutor` for the bundled example, or
`CeleryExecutor` for production) and that connections are healthy.

## Data / SQL

### STM transformation SQL has the wrong column prefix

Check `app/utils/sql_templates.py::_qualify_source_columns`. It expects raw
column names (e.g. `first_name`), not `s.first_name`. The renderer prefixes
them.

### Slow profiling on big tables

- Use sampling: pass `sample_size` in the profiling request.
- Schedule via **Airflow** instead of Celery so the UI doesn't await.
- Add an index on the profiled column. The profiler shows index hints.

## CI / quality gates

| Command              | Runs                                  |
|----------------------|---------------------------------------|
| `make ci`            | lint + typecheck + tests, full repo   |
| `make backend-ci`    | ruff + mypy + pytest                  |
| `make frontend-ci`   | eslint + tsc + vitest                 |

If `make ci` is green and prod fails, suspect environment differences first
(env vars, secrets, DB version) — code is rarely the culprit at that point.

## Still stuck?

- Tail backend logs: `make logs svc=backend` (or `docker compose logs -f backend`).
- Tail worker logs: `make logs-worker`.
- Open `/api/v1/health` and `/api/v1/health/db` for live diagnostics.
- File an issue with the `request_id` from the failing response — every log
  line carries it.
