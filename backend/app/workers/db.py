"""DB helpers for Celery worker tasks.

Provides a single context manager so worker tasks don't repeat the
``with Session(engine) as session:`` boilerplate in every file.
"""
from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

from sqlmodel import Session

from app.core.database import engine


@contextmanager
def task_session() -> Generator[Session, None, None]:
    """Yield a SQLModel `Session` bound to the global engine.

    The session is committed automatically only if the calling block does so;
    on exit, the session is closed regardless of success/failure.
    """
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()
