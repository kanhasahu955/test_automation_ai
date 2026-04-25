"""SQLModel + SQLAlchemy engine & session management."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import inspect, text
from sqlalchemy.pool import QueuePool
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    poolclass=QueuePool,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=1800,
    echo=False,
    future=True,
)


# Each entry: (table, column, column_definition).  The definitions are kept
# portable across MySQL/Postgres/SQLite — we sidestep dialect-specific syntax
# and rely on a column-existence check instead.
_PENDING_COLUMN_ADDITIONS: list[tuple[str, str, str]] = [
    ("stm_documents", "notes", "TEXT NULL"),
    ("stm_documents", "is_completed", "BOOLEAN NOT NULL DEFAULT 0"),
    ("stm_documents", "completed_at", "TIMESTAMP NULL"),
]


def _ensure_pending_columns() -> None:
    """Idempotently add columns added after the first deploy.

    `SQLModel.metadata.create_all` only creates *missing tables*; it never adds
    new columns to existing ones. Rather than ship a full Alembic stack just
    for a couple of additive columns, we inspect the live schema and emit
    `ALTER TABLE ... ADD COLUMN` for any column we know about that the DB
    doesn't already have. Safe to run on every boot.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, ddl in _PENDING_COLUMN_ADDITIONS:
            if table not in existing_tables:
                continue
            cols = {c["name"] for c in inspector.get_columns(table)}
            if column in cols:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def init_db() -> None:
    """Create all tables and apply additive column migrations."""

    from app.modules.ai_generator import models as _ai  # noqa: F401
    from app.modules.app_settings import models as _settings  # noqa: F401
    from app.modules.audit_logs import models as _audit  # noqa: F401
    from app.modules.auth import models as _auth  # noqa: F401
    from app.modules.data_profiling import models as _prof  # noqa: F401
    from app.modules.data_sources import models as _ds  # noqa: F401
    from app.modules.environments import models as _envs  # noqa: F401
    from app.modules.executions import models as _execs  # noqa: F401
    from app.modules.metadata import models as _meta  # noqa: F401
    from app.modules.no_code_flows import models as _flows  # noqa: F401
    from app.modules.notifications import models as _notif  # noqa: F401
    from app.modules.projects import models as _projects  # noqa: F401
    from app.modules.quality_monitoring import models as _qm  # noqa: F401
    from app.modules.schedules import models as _schedules  # noqa: F401
    from app.modules.sql_generator import models as _sql  # noqa: F401
    from app.modules.stm_converter import models as _stm  # noqa: F401
    from app.modules.test_cases import models as _tcs  # noqa: F401
    from app.modules.test_suites import models as _suites  # noqa: F401
    from app.modules.users import models as _users  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _ensure_pending_columns()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
