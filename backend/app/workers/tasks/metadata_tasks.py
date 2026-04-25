"""Async metadata scan tasks."""
from __future__ import annotations

from sqlmodel import select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.modules.data_sources.models import DataSource
from app.modules.data_sources.service import build_engine_url_for_data
from app.modules.metadata.models import MetadataColumn, MetadataTable
from app.utils.datetime import utc_now_naive
from app.workers.db import task_session


@celery_app.task(name="metadata.scan")
def scan_metadata(data_source_id: str) -> dict:
    with task_session() as session:
        ds = session.exec(select(DataSource).where(DataSource.id == data_source_id)).first()
        if not ds:
            return {"ok": False, "error": "data source not found"}
        url = build_engine_url_for_data(ds)
        if not url:
            return {
                "ok": False,
                "error": "Set a database name in Settings → Connections. After Test, use “Load databases” to pick one, save, then Scan.",
            }
        try:
            from sqlalchemy import create_engine, inspect

            target = create_engine(url, pool_pre_ping=True)
            inspector = inspect(target)
            scanned = 0
            cap = settings.METADATA_MAX_TABLES

            if ds.source_type == "POSTGRESQL":
                system_pg = {"information_schema", "pg_catalog", "pg_toast"}
                schema_names = [s for s in inspector.get_schema_names() if s not in system_pg and not s.startswith("pg_temp_")]
                for schema in schema_names:
                    if scanned >= cap:
                        break
                    for table_name in inspector.get_table_names(schema=schema):
                        if scanned >= cap:
                            break
                        meta_table = MetadataTable(
                            data_source_id=ds.id,
                            schema_name=schema,
                            table_name=table_name,
                            last_scanned_at=utc_now_naive(),
                        )
                        session.add(meta_table)
                        session.flush()
                        for col in inspector.get_columns(table_name, schema=schema):
                            session.add(
                                MetadataColumn(
                                    metadata_table_id=meta_table.id,
                                    column_name=col["name"],
                                    data_type=str(col.get("type")),
                                    is_nullable=bool(col.get("nullable", True)),
                                )
                            )
                        scanned += 1
            else:
                for table_name in inspector.get_table_names()[:cap]:
                    meta_table = MetadataTable(
                        data_source_id=ds.id,
                        schema_name=None,
                        table_name=table_name,
                        last_scanned_at=utc_now_naive(),
                    )
                    session.add(meta_table)
                    session.flush()
                    for col in inspector.get_columns(table_name):
                        session.add(
                            MetadataColumn(
                                metadata_table_id=meta_table.id,
                                column_name=col["name"],
                                data_type=str(col.get("type")),
                                is_nullable=bool(col.get("nullable", True)),
                            )
                        )
                    scanned += 1
            session.commit()
            return {"ok": True, "scanned_tables": scanned}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
