# QualityForge AI — Setup, Configuration & Run Guide

This is the single source of truth for getting QualityForge AI running locally and in
Docker, plus the full reference for every config knob, every quality gate and every
shared utility introduced during the latest refactor.

> The architecture overview, ER diagram, API surface and tech-stack diagrams live in
> `README.md` and `docs/`. **This file is about running and operating the stack.**

---

## Table of Contents

1. [Quick Start (TL;DR)](#1-quick-start-tldr)
2. [Repository Layout](#2-repository-layout)
3. [Prerequisites](#3-prerequisites)
4. [Configuration: YAML + `.env` + env vars](#4-configuration-yaml--env--env-vars)
5. [Run Path A — Docker Compose (recommended)](#5-run-path-a--docker-compose-recommended)
6. [Run Path B — Local development without Docker](#6-run-path-b--local-development-without-docker)
7. [Database Migrations (Alembic)](#7-database-migrations-alembic)
8. [Code Quality Gates](#8-code-quality-gates)
9. [Architecture: OOP, Class-based, Typed](#9-architecture-oop-class-based-typed)
10. [SQL Templates Folder (`backend/sql/`)](#10-sql-templates-folder-backendsql)
11. [Reusable Utilities, Hooks & Components](#11-reusable-utilities-hooks--components)
12. [API Testing (Postman / Bruno)](#12-api-testing-postman--bruno)
13. [Troubleshooting](#13-troubleshooting)
14. [Security Notes](#14-security-notes)

---

## 1. Quick Start (TL;DR)

```bash
# 0) From the repo root
make setup                  # copies .env files, installs backend (uv) + frontend (npm)
make up                     # builds & starts the full stack via docker-compose
make migrate                # applies alembic migrations inside the backend container
make health                 # GET http://localhost:8080/api/v1/health  → expects {"status":"ok"}
```

Then open:

| Surface         | URL                                   |
| --------------- | ------------------------------------- |
| Frontend (SPA)  | <http://localhost:8080>               |
| API (via Nginx) | <http://localhost:8080/api/v1>        |
| API (direct)    | <http://localhost:8000/api/v1>        |
| OpenAPI / Swagger | <http://localhost:8000/api/docs>    |
| Flower (Celery) | <http://localhost:5555>               |
| Airflow         | <http://localhost:8081> (admin/admin) |

Default bootstrap admin: **`admin@qualityforge.ai` / `Admin@12345`** (change in `.env`).

---

## 2. Repository Layout

```
qualityforge-ai/
├── backend/                         # FastAPI app, Celery workers, Airflow DAGs
│   ├── app/
│   │   ├── core/                    # config (YAML+env), db, security, errors, celery_app
│   │   │   ├── base/                # BaseRepository[T], BaseService    (NEW, OOP)
│   │   │   ├── config.py            # Pydantic Settings (YAML+env layered)
│   │   │   └── config_loader.py     # YAML loader + env→key map        (NEW)
│   │   ├── modules/                 # feature modules (auth, projects, ai_generator, …)
│   │   │   └── <module>/
│   │   │       ├── repository.py    # data access (NEW — controller-service-repository)
│   │   │       ├── service.py       # business logic (class + back-compat function shims)
│   │   │       ├── routes.py        # FastAPI controller layer
│   │   │       ├── schemas.py       # Pydantic v2 DTOs
│   │   │       └── models.py        # SQLModel ORM
│   │   ├── workers/                 # celery tasks + db helper (task_session)
│   │   ├── runners/                 # docker-runner scripts (sql, playwright, ge)
│   │   ├── schemas/                 # SHARED pydantic base schemas
│   │   ├── utils/
│   │   │   ├── sql_loader.py        # filesystem SQL loader (NEW)
│   │   │   ├── sql_templates.py     # StmSqlRenderer (OOP, uses sql_loader)
│   │   │   └── …                    # http_errors, datetime, pagination …
│   │   └── airflow_dags/            # Apache Airflow DAGs
│   ├── config/                      # *** YAML configuration layer (NEW) ***
│   │   ├── base.yaml                # non-secret defaults
│   │   ├── development.yaml         # APP_ENV=development overlay
│   │   ├── staging.yaml
│   │   ├── production.yaml
│   │   └── test.yaml
│   ├── sql/                         # *** ALL SQL lives here (NEW) ***
│   │   ├── README.md
│   │   ├── templates/stm/           # STM validation templates (.sql)
│   │   └── queries/health/          # canned queries (e.g. ping)
│   ├── alembic/                     # DB migrations (DDL stays here)
│   ├── tests/                       # pytest suite (now incl. config + loader tests)
│   ├── pyproject.toml               # uv-managed deps + ruff + mypy + pytest config
│   ├── uv.lock                      # locked exact versions
│   ├── Dockerfile                   # multi-stage uv-native image (copies sql/ + config/)
│   └── .env.example
│
├── frontend/                        # React 18 + TS + Vite SPA
│   ├── src/
│   │   ├── app/                     # App shell, store, routing
│   │   ├── components/
│   │   │   ├── common/              # ErrorBoundary, AuthLayout, SelectProjectHint, EmptyState …
│   │   │   └── layout/              # AppShell (sidebar/topbar)
│   │   ├── features/                # feature folders (auth, projects, executions, …)
│   │   ├── services/                # *** typed OOP API clients (NEW) ***
│   │   │   ├── BaseApiClient.ts     # abstract base — get/post/put/patch/delete + path()
│   │   │   ├── apiClient.ts         # axios instance + TokenStore class
│   │   │   ├── authApi.ts           # class AuthApiClient extends BaseApiClient
│   │   │   └── …                    # projects/exec/flow/stm/reports/testCase clients
│   │   ├── hooks/                   # useSelectedProject, useReduxErrorToast
│   │   ├── utils/                   # apiErrors, executionStatus
│   │   ├── constants/               # routes
│   │   └── theme/                   # antd theme tokens
│   ├── vite.config.ts               # path aliases + dev proxy
│   └── tsconfig.json
│
├── nginx/                           # Reverse proxy config
├── docs/                            # Diagrams (PNG) + Postman collection + index README
├── docker-compose.yml               # mysql, redis, backend, worker, beat, flower, frontend, nginx, airflow
├── Makefile                         # Single entrypoint for ALL ops (run `make help`)
├── README.md                        # Architecture, ER diagram, API map
└── SETUP.md                         # ← you are here
```

---

## 3. Prerequisites

| Tool                | Version  | Purpose                                          |
| ------------------- | -------- | ------------------------------------------------ |
| Docker + Compose v2 | ≥ 24     | Path A (recommended)                             |
| `uv`                | ≥ 0.4    | Python package manager (Path B + Docker build)   |
| Node.js             | ≥ 20 LTS | Frontend tooling                                 |
| MySQL 8             | optional | Only for Path B if not using Docker              |
| Redis 7             | optional | Only for Path B if not using Docker              |
| GNU Make            | any      | Convenience only; every target is a thin wrapper |

Install `uv`:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# or:  brew install uv
```

---

## 4. Configuration: YAML + `.env` + env vars

QualityForge AI uses a **layered configuration system**. You point YAML files at
non-secret defaults and use `.env` (or process env vars) for secrets and
host-specific knobs. Everything lands on the same strongly-typed
`app.core.config.Settings` Pydantic class.

### 4.0 Layering & precedence (highest wins)

| # | Source                                         | Lives in                                           | Purpose                                  |
|---|------------------------------------------------|----------------------------------------------------|------------------------------------------|
| 1 | Process environment variables                  | shell / Docker / k8s manifest                      | Per-deploy overrides + secrets injection |
| 2 | `.env` file                                    | `backend/.env` (gitignored)                        | Host-specific knobs + local secrets      |
| 3 | YAML overlay                                   | `backend/config/{APP_ENV}.yaml`                    | Per-environment defaults                 |
| 4 | YAML base                                      | `backend/config/base.yaml`                         | Project-wide non-secret defaults         |
| 5 | Field defaults                                 | `app/core/config.py::Settings`                     | Code-level fallbacks                     |

The wiring lives in `Settings.settings_customise_sources(...)`. Env vars **always**
beat YAML — the YAML layer is plumbed in as the lowest-priority Pydantic
`SettingsSource`. To redirect the YAML folder (e.g. in tests / k8s ConfigMaps)
set `QF_CONFIG_DIR=/path/to/config`.

### 4.1 YAML configuration files (`backend/config/`)

```
backend/config/
├── base.yaml          # shared defaults (committed)
├── development.yaml   # active when APP_ENV=development
├── staging.yaml       # active when APP_ENV=staging
├── production.yaml    # active when APP_ENV=production
└── test.yaml          # active when APP_ENV=test
```

Each file is a **deep-merge overlay** on top of `base.yaml`. The YAML→Settings
key mapping is declarative and lives in `app/core/config_loader.py::KEY_MAP`
— add a row there when you introduce a new YAML knob.

Example excerpt from `base.yaml`:

```yaml
app:
  name: "QualityForge AI"
  cors_origins:
    - "http://localhost:3000"
    - "http://localhost:5173"
database:
  pool_size: 10
  max_overflow: 20
worker:
  metadata_max_tables: 100
  profiling_max_tables: 50
```

`development.yaml` then narrows the pool:

```yaml
database:
  pool_size: 5
  max_overflow: 10
```

…and `production.yaml` widens it:

```yaml
database:
  pool_size: 30
  max_overflow: 50
```

> **Secrets never go in YAML.** `JWT_SECRET`, `OPENAI_API_KEY`,
> `ENCRYPTION_KEY`, `PASSWORD_PEPPER`, `DB_PASSWORD`, `BOOTSTRAP_ADMIN_PASSWORD`
> are deliberately **not** wired through `KEY_MAP` — set them via `.env` or
> your secret manager.

### 4.2 Backend — `backend/.env`

| Group       | Variable                       | Default                              | Notes                                                            |
| ----------- | ------------------------------ | ------------------------------------ | ---------------------------------------------------------------- |
| App         | `APP_ENV`                      | `development`                        | `development` / `staging` / `production`                         |
|             | `APP_DEBUG`                    | `true`                               | Enables verbose errors                                           |
|             | `APP_HOST` / `APP_PORT`        | `0.0.0.0` / `8000`                   |                                                                  |
|             | `API_PREFIX`                   | `/api/v1`                            | All routes mounted under this prefix                             |
|             | `CORS_ORIGINS`                 | `http://localhost:3000,…:5173`       | Comma-separated allow-list                                       |
| Security    | `JWT_SECRET`                   | **MUST be changed**                  | Long random string                                               |
|             | `JWT_ALGORITHM`                | `HS256`                              |                                                                  |
|             | `ACCESS_TOKEN_EXPIRES_MINUTES` | `60`                                 |                                                                  |
|             | `REFRESH_TOKEN_EXPIRES_DAYS`   | `14`                                 |                                                                  |
|             | `PASSWORD_PEPPER`              | **MUST be changed**                  | Mixed into bcrypt hashing                                        |
|             | `ENCRYPTION_KEY`               | **MUST be changed**                  | Fernet key — generate via `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| Database    | `DB_HOST`                      | `mysql` / `127.0.0.1`                | `mysql` for compose, `127.0.0.1` for local                       |
|             | `DB_USER` / `DB_PASSWORD`      | `root` / `root`                      |                                                                  |
|             | `DB_NAME`                      | `qualityforge`                       |                                                                  |
|             | `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `10` / `20`                       | SQLAlchemy pool tuning                                           |
|             | `DB_CONNECT_TIMEOUT_S`         | `10`                                 | Used by metadata-scan probes                                     |
| Redis/Celery| `REDIS_URL`                    | `redis://redis:6379/0`               |                                                                  |
|             | `CELERY_BROKER_URL`            | `redis://redis:6379/1`               |                                                                  |
|             | `CELERY_RESULT_BACKEND`        | `redis://redis:6379/2`               |                                                                  |
| Storage     | `ARTIFACTS_DIR` / `UPLOADS_DIR`| `/var/qf/{artifacts,uploads}`        | Mounted as Docker volumes                                        |
| AI          | `OPENAI_API_KEY`               | *(empty)*                            | Required only if `AI_ENABLED=true`                               |
|             | `OPENAI_BASE_URL`              | `https://api.openai.com/v1`          | Override for Azure / proxy                                       |
|             | `OPENAI_MODEL`                 | `gpt-4o-mini`                        |                                                                  |
|             | `AI_ENABLED`                   | `true`                               |                                                                  |
| **Worker / data tuning (NEW)** | `METADATA_MAX_TABLES`     | `100`                              | Cap per metadata-scan job                                        |
|             | `PROFILING_MAX_TABLES`         | `50`                                 | Cap per profiling job                                            |
|             | `PROFILING_SAMPLE_SIZE`        | `1000`                               | Sample size per table in profiling                               |
|             | `REPORT_RECENT_RUNS_LIMIT`     | `50`                                 | Dashboard "recent runs" limit                                    |
|             | `STM_VALIDATION_FETCH`         | `50`                                 | Fetch-many size in STM validation                                |
| Bootstrap   | `BOOTSTRAP_ADMIN_*`            | see `.env.example`                   | Created on first boot if no users exist                          |

### 4.3 Frontend — `frontend/.env`

| Variable             | Default                              | Notes                                     |
| -------------------- | ------------------------------------ | ----------------------------------------- |
| `VITE_API_BASE_URL`  | `http://localhost:8000/api/v1`       | Used by axios instance in `apiClient.ts`  |
| `VITE_API_PROXY`     | `http://localhost:8000`              | Read by `vite.config.ts` for `/api` proxy |

Path aliases (kept in sync between `vite.config.ts` and `tsconfig.json`):

```
@app/*         → src/app/*
@components/*  → src/components/*
@features/*    → src/features/*
@services/*    → src/services/*
@hooks/*       → src/hooks/*
@utils/*       → src/utils/*
@apptypes/*    → src/types/*
@theme/*       → src/theme/*
@constants/*   → src/constants/*    ← NEW
```

---

## 5. Run Path A — Docker Compose (recommended)

```bash
make setup        # one-shot: env + uv sync + npm install
make up           # docker compose up -d --build
make migrate      # alembic upgrade head (inside the backend container)
make ps           # show container health
make logs         # tail every service
make logs svc=worker
make health       # curl /api/v1/health via Nginx
```

Stack services & ports:

| Service    | Container        | Host port | Purpose                          |
| ---------- | ---------------- | --------- | -------------------------------- |
| `frontend` | qf_frontend      | 3000      | SPA (also reverse-proxied by Nginx) |
| `nginx`    | qf_nginx         | 8080      | Public entry — `/` → SPA, `/api` → backend |
| `backend`  | qf_backend       | 8000      | FastAPI                          |
| `worker`   | qf_worker        | —         | Celery worker (all queues)       |
| `beat`     | qf_beat          | —         | Celery beat scheduler            |
| `flower`   | qf_flower        | 5555      | Celery monitoring UI             |
| `mysql`    | qf_mysql         | 3306      | MySQL 8                          |
| `redis`    | qf_redis         | 6379      | Redis 7 (broker + cache)         |
| `airflow`  | qf_airflow       | 8081      | Airflow webserver (optional)     |

**Useful one-liners:**

```bash
make restart svc=backend                # bounce a single service
make rebuild svc=backend                # no-cache rebuild + restart
make exec svc=backend                   # /bin/sh inside the container
make mysql-cli                          # MySQL shell
make redis-cli
make logs-worker                        # tail celery worker
make up-fresh                           # DESTROY volumes + rebuild
make db-reset                           # DESTRUCTIVE: drop volumes + re-migrate
```

---

## 6. Run Path B — Local development without Docker

You need MySQL 8 + Redis 7 reachable on the host. Then:

### Backend

```bash
cd backend
cp .env.example .env             # edit DB_HOST=127.0.0.1 if running MySQL locally
uv sync                          # creates .venv from uv.lock

# Three processes (in separate terminals or via tmux)
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
uv run celery -A app.core.celery_app.celery_app worker -l info -Q execution,ai,stm,profiling,metadata,default
uv run celery -A app.core.celery_app.celery_app beat   -l info
```

…or with the Makefile from the repo root:

```bash
make backend-install
make migrate
make api          # uvicorn  (foreground)
make worker       # celery worker
make beat         # celery beat
make flower       # http://localhost:5555
```

### Frontend

```bash
cd frontend
cp .env.example .env             # default points at http://localhost:8000
npm install
npm run dev                      # http://localhost:5173
```

…or:

```bash
make frontend-install
make web                         # vite dev server
make frontend-build              # production bundle
```

### Adding dependencies

```bash
make backend-add pkg=tenacity              # uv add tenacity
make backend-add-dev pkg=pytest-mock       # uv add --dev pytest-mock
make backend-remove pkg=ujson
make backend-update                        # uv lock --upgrade
make frontend-add pkg=clsx
make frontend-add-dev pkg=vitest
```

---

## 7. Database Migrations (Alembic)

```bash
make migrate                               # apply latest
make migration name=add_widget_table       # autogenerate a revision
make db-current                            # show current head
make db-history                            # full revision graph
make db-downgrade                          # rollback one step
make db-reset                              # DESTROY volumes + re-run migrations
```

Migrations auto-detect whether you're running locally (uses `uv run`) or against the
docker stack (uses `docker compose exec backend`). No flags needed.

---

## 8. Code Quality Gates

Everything is wired into `pyproject.toml` (backend) and `package.json` (frontend), and
exposed via the Makefile.

### Backend

| Tool   | Command                  | Status |
| ------ | ------------------------ | ------ |
| Ruff   | `make backend-lint`      | ✅ 0 errors |
| Ruff (autofix + format) | `make backend-format` | — |
| Mypy   | `make backend-typecheck` | ✅ 0 errors over 132 files |
| Pytest | `make backend-test`      | ✅ 22/22 passing (incl. YAML config + SQL loader) |

Notable `pyproject.toml` policies (pre-set, no action needed):

- `tool.ruff.lint.ignore` — `UP042/UP046/UP047` (incompatible with SQLModel/Pydantic generics).
- `tool.ruff.lint.per-file-ignores` — `alembic/env.py` and `tests/**.py` may import after `sys.path` mutation (`E402`).
- `tool.mypy.exclude` — `alembic/versions` and `app/airflow_dags` (Airflow's stub set is intentionally permissive).
- `tool.mypy.overrides` for `app.modules.*` and `app.workers.*` — silences SQLModel's known `union-attr/attr-defined/return-value/arg-type/assignment/operator` false positives.

### Frontend

| Tool      | Command                   | Status |
| --------- | ------------------------- | ------ |
| ESLint    | `make frontend-lint`      | ✅ 0 errors, 0 warnings |
| TypeScript| `make frontend-typecheck` | ✅ 0 errors |
| Vite build| `make frontend-build`     | — |

### Combined

```bash
make lint          # backend + frontend
make typecheck     # mypy + tsc
make test          # backend pytest
make ci            # lint + typecheck + test
```

---

## 9. Architecture: OOP, Class-based, Typed

The codebase follows a strict **Controller → Service → Repository** flow on the
backend and a parallel **Page → Saga → ApiClient** flow on the frontend.

### 9.1 Backend layering

```
                ┌────────────────────────┐
HTTP request →  │    routes.py (Ctrl)    │  FastAPI router, DTO validation, deps wiring
                └──────────┬─────────────┘
                           ↓
                ┌────────────────────────┐
                │  service.py (XxxService) │  business logic, transactions, logging
                └──────────┬─────────────┘
                           ↓
                ┌────────────────────────┐
                │ repository.py (XxxRepo) │  pure data access (extends BaseRepository[T])
                └──────────┬─────────────┘
                           ↓
                ┌────────────────────────┐
                │   models.py (SQLModel)  │  ORM tables
                └────────────────────────┘
```

**Base classes** (`app/core/base/`):

- `BaseRepository[ModelT]` — generic CRUD: `get`, `get_or_404`, `list`,
  `create`, `update`, `delete`. Take a `Session` per call so they're
  Celery- and request-safe. Subclasses set `model = MyModel` and add
  domain-specific finders.
- `BaseService` — gives every service a structured logger
  (`self.log = get_logger(...)`) and a `bind(**ctx)` helper for request-scoped
  context (user id, project id, etc.).

**Reference implementation** — `auth` and `projects`:

```python
# app/modules/projects/repository.py
class ProjectRepository(BaseRepository[Project]):
    model = Project
    def search(self, session, params, *, term=None): ...

# app/modules/projects/service.py
class ProjectService(BaseService):
    def __init__(self, repo: ProjectRepository | None = None) -> None:
        super().__init__()
        self._repo = repo or ProjectRepository()

    def create(self, session, payload: ProjectCreate, *, owner_id: str) -> Project: ...
    def get(self, session, project_id: str) -> Project: ...
    def list(self, session, params, search=None): ...
    def update(self, session, project_id, payload): ...
    def delete(self, session, project_id): ...

project_service = ProjectService()
```

Routes still call `service.create_project(session, payload, owner_id=...)` —
the module exports both the **class** (`ProjectService`) and **back-compat
function shims** that delegate to the singleton, so older imports keep working
while new code can dependency-inject a fake repository in tests.

### 9.2 Frontend layering

```
Page  ─dispatch─▶  Slice/Saga  ─call─▶  XxxApiClient  ─axios─▶  Backend
```

- `services/BaseApiClient.ts` — abstract base providing `get<T>`, `post<T,B>`,
  `put<T,B>`, `patch<T,B>`, `delete<T>` with `response.data` already
  unwrapped, plus `path()` that prepends an optional class-level `basePath`.
- `services/apiClient.ts` — owns the singleton axios instance and a
  `TokenStore` class that holds `accessToken` / `refreshToken` /
  `onUnauthorized`. Refresh-token rotation is single-flight: concurrent 401s
  queue behind one refresh request.
- Each domain client extends the base, e.g.:

```ts
// services/authApi.ts
export class AuthApiClient extends BaseApiClient {
  constructor() { super("/auth"); }
  login(email: string, password: string): Promise<TokenResponse> {
    return this.post<TokenResponse>("/login-json", { email, password });
  }
  // …
}
export const authApi = new AuthApiClient();
```

Other classes shipped: `ProjectsApiClient`, `AiApiClient`,
`ExecutionApiClient`, `FlowApiClient`, `ReportsApiClient`, `StmApiClient`,
`TestCaseApiClient`. Each module also re-exports a `xxxApi` object literal
with the same method names so existing sagas continue to compile.

### 9.3 Why this design

| Goal             | How it's served                                                                   |
|------------------|-----------------------------------------------------------------------------------|
| Scalable         | Repositories are stateless, share one connection pool, and trivially horizontal-scale. |
| Reusable         | Generic `BaseRepository[T]` removes ~70 % of CRUD boilerplate per module.         |
| Typed            | `Generic[ModelT]`, `Promise<T>`, Pydantic v2 DTOs, no `Any` in public signatures. |
| Testable         | Constructor-injected repositories → swap in fakes; no globals to mock.            |
| Observable       | `BaseService.log` is a `structlog.get_logger(...)` per class; one place to add metrics. |
| Performant       | Single axios instance, single SQL pool, `lru_cache` on `get_settings()`, in-process SQL template cache. |
| Smooth FE perf   | Vite + code-split builds, `useMemo`/`useCallback` patterns, single-flight token refresh. |

---

## 10. SQL Templates Folder (`backend/sql/`)

Every raw SQL string the application emits or executes lives **on disk** under
`backend/sql/`, never inline in Python. This makes SQL diffable, syntax-highlightable,
DBA-reviewable, and unit-testable.

```
backend/sql/
├── README.md
├── templates/
│   └── stm/
│       ├── row_count.sql
│       ├── null_check.sql
│       ├── duplicate_check.sql
│       ├── reference_check.sql
│       └── transformation_check.sql
└── queries/
    └── health/
        └── ping.sql
```

### 10.1 Loading a template

```python
from app.utils.sql_loader import sql_loader

sql = sql_loader.render(
    "templates/stm/row_count",
    src_table="customer_raw",
    tgt_table="dim_customer",
)
```

`SqlLoader` is thread-safe, caches by relative path, and:

- raises `SqlTemplateNotFound` if the file is missing.
- raises `SqlTemplateError` if a placeholder is missing (no silent SQL with
  literal `{tgt_col}` in production).
- blocks `..` traversal — you cannot escape `backend/sql/`.

Placeholders are plain `str.format_map` (`{name}`) — escape literal braces as
`{{` / `}}`.

### 10.2 STM renderer (`StmSqlRenderer`)

The class-based renderer composes a typed `StmMappingSpec` with the loader:

```python
from app.utils.sql_templates import StmMappingSpec, StmSqlRenderer, ValidationType

renderer = StmSqlRenderer()  # defaults to backend/sql/
sql = renderer.render(StmMappingSpec(
    src_table="customer_raw",
    tgt_table="dim_customer",
    src_col="first_name",
    tgt_col="customer_name",
    join_key="customer_id",
    transformation_rule="UPPER(first_name)",
    validation_type=ValidationType.TRANSFORMATION_CHECK,
))
```

A back-compat function `render_validation_sql(mapping_dict)` is exported so
existing `app.modules.stm_converter` callers keep working.

### 10.3 Adding a new template

1. Drop the `.sql` file under the right folder.
2. Use single-brace placeholders.
3. Add a method on the relevant renderer (or just call `sql_loader.render(...)`).
4. Add a test fixture if it's reusable.

### 10.4 What is **not** in `sql/`

- DDL / migrations → still owned by **Alembic** (`backend/alembic/versions/`).
- ORM-generated queries → SQLAlchemy / SQLModel emit them; `sql/` is for the
  hand-written / templated cases only.

---

## 11. Reusable Utilities, Hooks & Components

These were extracted across the refactor — **use them instead of duplicating logic**.

### 11.1 Backend

| Module                                | What it provides                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `app/core/base/repository.py`         | `BaseRepository[ModelT]` — generic CRUD + paginated `list(where=…, order_by=…)`.             |
| `app/core/base/service.py`            | `BaseService` — class-bound structlog + `bind(**ctx)`.                                       |
| `app/core/config.py` + `config_loader.py` | Strongly-typed Pydantic settings layered on top of `config/*.yaml` overlays.            |
| `app/utils/sql_loader.py`             | `SqlLoader` — read & render `backend/sql/**.sql` with placeholder substitution + caching.   |
| `app/utils/sql_templates.py`          | `StmMappingSpec`, `StmSqlRenderer`, `ValidationType` — class-based STM SQL renderer.        |
| `app/utils/datetime.py`               | `utc_now_naive()`, `utc_now_aware()`, `utc_naive_from()`, `utc_naive_offset()`.             |
| `app/utils/http_errors.py`            | `not_found(resource, id=…)`, `conflict(message)`, `invalid(message, field=…)`.              |
| `app/utils/pagination.py`             | `PageParams`, `Page[T]`, `page_of(items, total, params)`, `total_pages(total, size)`.       |
| `app/schemas/common.py`               | `ORMModel`, `EntityRead`, `JobQueuedResponse`, `IdsCreatedResponse`, `OkResponse`.          |
| `app/workers/db.py`                   | `with task_session() as session:` — single Celery session helper.                           |

### 11.2 Frontend

| Module                                                    | What it provides                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/services/BaseApiClient.ts`                           | Abstract typed base — `get<T>`, `post<T,B>`, `put<T,B>`, `patch<T,B>`, `delete<T>` + `path()`. |
| `src/services/apiClient.ts`                               | Singleton axios + `TokenStore` class (single-flight refresh-token rotation).                 |
| `src/services/{auth,projects,ai,execution,flow,reports,stm,testCase}Api.ts` | Domain `XxxApiClient` classes, each with a stable `xxxApi` object literal for back-compat. |
| `src/utils/apiErrors.ts`                                  | `getApiErrorMessage(err, fallback)` and `getApiFieldErrors(err)`.                            |
| `src/utils/executionStatus.ts`                            | `executionStatusColor(status)` + `ExecutionStatus` type.                                    |
| `src/constants/routes.ts`                                 | `ROUTES.LOGIN`, `ROUTES.DASHBOARD`, `ROUTES.FLOW_DETAIL(id)` … kills magic strings.         |
| `src/components/common/SelectProjectHint.tsx`             | One-liner replacement for "Select a project…" alerts.                                       |
| `src/components/common/EmptyState.tsx`                    | Reusable empty-state card (`description`, optional `action`).                               |
| `src/components/common/AuthLayout.tsx`                    | Shared visual shell for `LoginPage` & `RegisterPage`.                                       |
| `src/components/common/ErrorBoundary.tsx`                 | Top-level React error boundary, wired in `main.tsx`.                                        |
| `src/hooks/useSelectedProject.ts`                         | `{ project, projectId, hasProject }` — replaces the `useAppSelector` boilerplate.            |
| `src/hooks/useReduxErrorToast.ts`                         | "Show antd error toast when slice goes to error state" — one-liner.                         |

### 11.3 Single-source-of-truth ops

| Concern              | Single owner                                          |
| -------------------- | ----------------------------------------------------- |
| Dependency mgmt (BE) | `backend/pyproject.toml` + `backend/uv.lock`          |
| Dependency mgmt (FE) | `frontend/package.json` + `frontend/package-lock.json`|
| Lint config (BE)     | `[tool.ruff]` block in `pyproject.toml`               |
| Type config (BE)     | `[tool.mypy]` block in `pyproject.toml`               |
| Lint config (FE)     | `frontend/.eslintrc.cjs`                              |
| Type config (FE)     | `frontend/tsconfig.json`                              |
| All ops              | `Makefile` at repo root (`make help`)                 |

---

## 12. API Testing (Postman / Bruno)

Postman collection + environment shipped in `docs/`:

```bash
make postman   # prints the two paths
```

- `docs/qualityforge-ai.postman_collection.json` — 82 requests across all 11 modules, with auto-saving scripts for `accessToken`, `projectId`, `testCaseId`, `flowId`, `runId`, `stmDocumentId`.
- `docs/qualityforge-ai.postman_environment.json` — 17 variables (base URL, IDs, tokens).

Import both → select environment → run **Auth → Login** → every other request inherits the token automatically.

---

## 13. Troubleshooting

| Symptom                                                      | Fix                                                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `npm error ENOENT … package.json` from repo root             | You're not in `frontend/`. Use `make web` (cd's for you) or `cd frontend && npm run dev`. |
| `uv sync` fails with conflict on `pandas` / `great-expectations` | Already resolved in `pyproject.toml` (≥2.2.3,<3 / ≥1.3.0,<2). Run `uv lock --upgrade`.   |
| `alembic` says "Target database is not up to date"           | `make migrate` (or `make db-reset` if you don't care about data).                         |
| Port 8080 already in use                                     | Edit `nginx.ports` in `docker-compose.yml` or `make down` first.                          |
| `mysql` healthcheck flaps                                    | First boot needs ~20 s. `make logs svc=mysql` to confirm `ready for connections`.         |
| Celery tasks stuck `PENDING`                                 | `make logs-worker`. Confirm worker subscribes to the right queues (see `WORKER_QUEUES` in Makefile). |
| Frontend can't reach API in dev                              | Check `VITE_API_BASE_URL` and `VITE_API_PROXY` in `frontend/.env`; vite proxies `/api`.   |
| `500 Internal Server Error` on token refresh                 | `JWT_SECRET` changed → existing refresh tokens are invalid. Logout / re-login.            |
| `cryptography.fernet.InvalidKey`                             | `ENCRYPTION_KEY` must be a base64 Fernet key — regenerate (see env table above).          |
| Make help lists empty section names                          | Pre-fixed: only target groups (`# ── … ──`) become headers; variable groups use `# -- … --`. |
| `SqlTemplateNotFound: …` at runtime                          | The `.sql` file is missing or you're running against an image that didn't bundle `backend/sql/`. The Dockerfile copies it — rebuild with `make rebuild svc=backend`. Locally, ensure `cwd` is `backend/` or set `QF_CONFIG_DIR`/just run via `uv run`. |
| `SqlTemplateError: Missing placeholder 'xxx'`                | A renderer call doesn't supply a variable the template needs. Open the SQL file's header comment — required vars are listed there. |
| Backend reads stale value after editing `config/*.yaml`      | The settings object is `lru_cache`'d. Restart the API process (or call `app.core.config.get_settings.cache_clear()` in tests). |
| YAML ignored, env vars also ignored                          | Check `APP_ENV` — `config/{APP_ENV}.yaml` is the active overlay. If unset it falls back to `development`. |
| Test wants different config dir                              | Set `QF_CONFIG_DIR=/abs/path` before importing `app.core.config`; see `tests/test_config_yaml.py`. |

---

## 14. Security Notes

> **Action required before any deployment:**

1. **Rotate `JWT_SECRET`, `PASSWORD_PEPPER`, `ENCRYPTION_KEY`** — the example values are placeholders and must be replaced.
2. **Rotate `BOOTSTRAP_ADMIN_PASSWORD`** — change it before `make up`, or change it via the API immediately after first boot.
3. **`OPENAI_API_KEY`** — never commit a real key. Keep it in `.env` (already gitignored). If a key was ever committed, **revoke it at <https://platform.openai.com/api-keys>** and generate a new one.
4. **CORS** — set `CORS_ORIGINS` to only the domains that actually need access in `staging` / `production`.
5. **TLS** — terminate TLS at the Nginx layer (or upstream) before exposing publicly. The shipped `nginx.conf` is HTTP-only by design for local dev.
6. **MySQL credentials** — change `DB_PASSWORD` (and the `MYSQL_ROOT_PASSWORD` in `docker-compose.yml`) before deploying.

---

Run `make help` any time for the full list of targets — it's the canonical operations index.
