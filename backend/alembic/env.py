"""Alembic environment configuration."""
from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

from alembic import context
from app.core.config import settings
from app.core.database import init_db

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.database_url)

# Register all models with SQLModel.metadata
init_db.__wrapped__ if hasattr(init_db, "__wrapped__") else init_db
import app.modules.ai_generator.models
import app.modules.audit_logs.models
import app.modules.auth.models
import app.modules.data_profiling.models
import app.modules.data_sources.models
import app.modules.environments.models
import app.modules.executions.models
import app.modules.metadata.models
import app.modules.no_code_flows.models
import app.modules.notifications.models
import app.modules.projects.models
import app.modules.quality_monitoring.models
import app.modules.schedules.models
import app.modules.sql_generator.models
import app.modules.stm_converter.models
import app.modules.test_cases.models
import app.modules.test_suites.models
import app.modules.users.models  # noqa: F401

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
