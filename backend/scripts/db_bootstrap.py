"""Database bootstrap CLI.

Drives schema creation and connectivity checks against whichever database
``backend/.env`` currently points at. Used by Make targets:

    make db-init   -> python -m scripts.db_bootstrap init
    make db-ping   -> python -m scripts.db_bootstrap ping

Run directly:

    cd backend && uv run python -m scripts.db_bootstrap init
    cd backend && uv run python -m scripts.db_bootstrap ping
"""
from __future__ import annotations

import sys

from sqlalchemy import text
from sqlmodel import Session

from app.bootstrap import ensure_admin_user
from app.core.config import settings
from app.core.database import engine, init_db


def _mode_label() -> str:
    """Best-effort label for the active runtime profile."""
    host = settings.DB_HOST.lower()
    if host in {"mysql", "qf_mysql", "db"}:
        return "DOCKER"
    if host in {"127.0.0.1", "localhost", "::1"}:
        return "HOST" if settings.DB_PORT == 3306 else "HOST→DOCKER (compose port)"
    return "CUSTOM"


def _banner() -> None:
    print("┌─────────────────────────────────────────────────────────────")
    print("│ QualityForge AI · DB bootstrap")
    print(f"│ mode      : {_mode_label()}")
    print(f"│ host:port : {settings.DB_HOST}:{settings.DB_PORT}")
    print(f"│ database  : {settings.DB_NAME}")
    print(f"│ user      : {settings.DB_USER}")
    print("└─────────────────────────────────────────────────────────────")


def cmd_ping() -> int:
    _banner()
    try:
        with engine.connect() as conn:
            version = conn.execute(text("SELECT VERSION()")).scalar_one()
            tables = conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema = :db"
                ),
                {"db": settings.DB_NAME},
            ).scalar_one()
        print(f"✓ connected — MySQL {version}")
        print(f"✓ tables in `{settings.DB_NAME}`: {tables}")
        if tables == 0:
            print("\nNo tables yet — run:  make db-init")
        return 0
    except Exception as exc:
        print(f"✗ connect failed: {exc.__class__.__name__}: {exc}")
        if "Access denied" in str(exc):
            print("  hint: did you run `make db-create-local` against your local MySQL?")
        elif "Unknown database" in str(exc):
            print("  hint: database doesn't exist — run `make db-create-local`")
        elif "Can't connect" in str(exc) or "refused" in str(exc).lower():
            print(
                f"  hint: nothing is listening on {settings.DB_HOST}:{settings.DB_PORT}\n"
                "  • host mode: is your local MySQL running? (`brew services list`)\n"
                "  • docker mode: is the stack up? (`make ps`)"
            )
        return 1


def cmd_init() -> int:
    _banner()
    print("→ creating tables (SQLModel.metadata.create_all)…")
    init_db()
    print("✓ schema created / up-to-date")

    print("→ ensuring bootstrap admin user…")
    with Session(engine) as session:
        ensure_admin_user(session)
    print(f"✓ admin user: {settings.BOOTSTRAP_ADMIN_EMAIL}")
    print("\nDone. Now: `make api` (and in another tab: `make worker` / `make web`).")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in {"init", "ping"}:
        print("Usage: python -m scripts.db_bootstrap {init|ping}", file=sys.stderr)
        return 2
    return {"init": cmd_init, "ping": cmd_ping}[argv[1]]()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
