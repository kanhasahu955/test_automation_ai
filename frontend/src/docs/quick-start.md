# Quick Start

This is the fastest path to a running stack on a developer machine.

## Prerequisites

| Tool       | Version | Why                              |
|------------|---------|----------------------------------|
| Python     | 3.11+   | FastAPI backend (managed by `uv`)|
| Node.js    | 20+     | Frontend (Vite + React 18)       |
| Docker     | 24+     | MySQL, Redis, optional services  |
| `uv`       | latest  | Python package manager           |
| `make`     | any     | Top-level orchestration          |

Install `uv` if you don't have it:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## 1. One-shot bootstrap

From the repo root:

```bash
make setup        # copies .env files + installs backend (uv) and frontend (npm) deps
```

What that did:

- `cp backend/.env.example backend/.env`
- `cp frontend/.env.example frontend/.env`
- `uv sync --frozen` in `backend/`
- `npm install` in `frontend/`

Open `backend/.env` and set at least:

```dotenv
DB_PASSWORD=change-me
JWT_SECRET=please-generate-a-32+-char-random-string
```

> **Never commit real secrets.** YAML files in `backend/config/` hold defaults
> only; secrets stay in `.env` or your secret manager.

## 2. Run everything (the easy path)

```bash
make up           # build & start the full stack via Docker Compose
make ps           # see container status
make health       # ping the API health endpoint
```

That brings up MySQL, Redis, the backend API, the Celery worker, the frontend
and Nginx — all wired together.

Tail logs for any service:

```bash
make logs                    # all services
make logs svc=backend        # one service
make logs-worker             # convenience alias
```

Stop / reset:

```bash
make down                    # stop + remove containers (keeps volumes)
make up-fresh                # nuke volumes and rebuild from scratch
```

## 3. Run the dev path (host backend + host frontend)

If you'd rather iterate on code without rebuilding containers, run the
infrastructure in Docker but the apps on your host:

```bash
docker compose up -d mysql redis     # infra only
make migrate                          # apply alembic migrations
make api                              # FastAPI on :8000 with --reload
```

In a second terminal:

```bash
make web                              # Vite dev server on :5173
```

In a third terminal (only if you're working on async tasks):

```bash
make worker                           # Celery worker
make beat                             # Celery beat scheduler
```

## 4. Verify

```bash
curl http://localhost:8000/api/v1/health
open http://localhost:5173            # frontend
open http://localhost:8000/docs       # OpenAPI / Swagger UI
```

Sign in (or register a new account) to begin.

## What's running where

| Service            | Default URL                     |
|--------------------|---------------------------------|
| Frontend (dev)     | http://localhost:5173           |
| Frontend (Docker)  | http://localhost:3000           |
| Backend API        | http://localhost:8000/api/v1    |
| Backend OpenAPI    | http://localhost:8000/docs      |
| MySQL              | localhost:3307                  |
| Redis              | localhost:6379                  |
| Nginx (Docker)     | http://localhost:8080           |

You're done. Continue with **Using the App** for a feature walk-through, or jump
to the operations pages (Docker, Celery, Airflow, Nginx) when you're ready to
deploy.
