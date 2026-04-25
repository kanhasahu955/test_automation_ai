# Architecture

QualityForge AI follows a **modular monolith** with clear seams that let you
extract services later without rewriting business logic.

## Backend — Controller → Service → Repository

```text
HTTP request
   │
   ▼
┌──────────────┐    Pydantic-validated DTOs
│  Controller  │  ──────────────────────────►  ┌─────────────┐
│ (FastAPI)    │                                │  Service    │
└──────────────┘                                │ (BaseService│
                                                │  subclass)  │
                                                └──────┬──────┘
                                                       │
                                              ┌────────▼────────┐
                                              │   Repository    │
                                              │ (BaseRepository)│
                                              └────────┬────────┘
                                                       │
                                                ┌──────▼──────┐
                                                │  Database   │
                                                └─────────────┘
```

### Base classes

- `BaseRepository[T]` — generic CRUD: `get`, `get_or_404`, `list`, `create`, `update`, `delete`.
- `BaseService` — gives every service a structured `self.log` and a `bind(**ctx)` helper.
- `AppException` hierarchy — typed errors that map cleanly to HTTP status codes.

Each module follows the same shape:

```text
backend/app/modules/<module>/
├── controller.py    # FastAPI routes
├── service.py       # business logic (extends BaseService)
├── repository.py    # data access (extends BaseRepository[T])
├── schemas.py       # request/response DTOs
└── models.py        # SQLModel ORM models
```

## Frontend — Page · Saga · ApiClient

```text
React Page  ───── dispatch ───►  Redux Slice
     ▲                                 │
     │                                 ▼
     │                            Redux Saga ─────► XxxApiClient
     │                                                    │
     └──────────  selectors / hooks  ──────────  ◄── Axios │
                                                          ▼
                                                     FastAPI backend
```

- **`BaseApiClient`** — typed wrapper around Axios with `get`, `post`, `put`, `patch`, `delete`.
- **`TokenStore`** — single source of truth for access/refresh tokens.
- **Per-feature clients** — `AuthApiClient`, `ProjectsApiClient`, … each extending `BaseApiClient`.
- **Sagas** — handle side-effects, retries, and toast notifications.
- **Selectors + hooks** — components stay dumb; hooks expose typed state.

## Configuration layering (precedence — first wins)

```text
   process env vars
        ▼
   backend/.env (dotenv)
        ▼
   backend/config/{APP_ENV}.yaml   ← per-environment overrides
        ▼
   backend/config/base.yaml        ← shared defaults
        ▼
   field defaults in Pydantic Settings
```

Set `APP_ENV=development|staging|production|test` to switch overlays.
See the **Configuration** page for the full key map.

## SQL templates

All raw SQL lives under `backend/sql/`:

```text
backend/sql/
├── queries/health/ping.sql
└── templates/stm/
    ├── row_count.sql
    ├── null_check.sql
    ├── duplicate_check.sql
    ├── reference_check.sql
    └── transformation_check.sql
```

A thread-safe `SqlLoader` caches templates and renders them with
`str.format_map`. The `StmSqlRenderer` composes the loader with a typed
`StmMappingSpec` to render validation SQL for the STM Converter.

## Cross-cutting concerns

| Concern        | Implementation                                   |
|----------------|--------------------------------------------------|
| Logging        | `structlog` (JSON in prod, pretty in dev)        |
| Auth           | JWT access + opaque refresh, hashed in DB        |
| Validation     | Pydantic v2 / SQLModel                           |
| Caching        | Redis (per-request + per-feature TTL)            |
| Background    | Celery (low-latency) + Airflow (long-running ETL)|
| Observability  | OpenAPI · request IDs · structured logs          |
| Migrations     | Alembic (`make migrate`)                         |

The diagram below summarises which subsystem owns which traffic class:

```text
real-time UI requests        →  FastAPI (sync + async)
short async jobs              →  Celery worker  →  Redis broker
long ETL / orchestrated DAGs  →  Airflow scheduler + workers
```
