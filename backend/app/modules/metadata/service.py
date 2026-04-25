"""Metadata services."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.core.errors import NotFoundError
from app.modules.metadata.models import MetadataColumn, MetadataTable


def list_tables(session: Session, data_source_id: str) -> list[MetadataTable]:
    return session.exec(
        select(MetadataTable)
        .where(MetadataTable.data_source_id == data_source_id)
        .order_by(MetadataTable.table_name)
    ).all()


def get_table(session: Session, table_id: str) -> MetadataTable:
    table = session.exec(select(MetadataTable).where(MetadataTable.id == table_id)).first()
    if not table:
        raise NotFoundError("Metadata table not found")
    return table


def list_columns(session: Session, metadata_table_id: str) -> list[MetadataColumn]:
    return session.exec(
        select(MetadataColumn)
        .where(MetadataColumn.metadata_table_id == metadata_table_id)
        .order_by(MetadataColumn.column_name)
    ).all()


def get_column(session: Session, column_id: str) -> MetadataColumn:
    column = session.exec(
        select(MetadataColumn).where(MetadataColumn.id == column_id)
    ).first()
    if not column:
        raise NotFoundError("Metadata column not found")
    return column


# ---------- Discovery (summary + global search) ------------------------------


def get_summary(session: Session, data_source_id: str) -> dict[str, Any]:
    """Connection-level KPIs: table count, total rows, avg quality, last scan."""
    table_count = session.exec(
        select(func.count(MetadataTable.id)).where(
            MetadataTable.data_source_id == data_source_id
        )
    ).one()
    total_rows: Any = session.exec(
        select(func.coalesce(func.sum(MetadataTable.row_count), 0)).where(
            MetadataTable.data_source_id == data_source_id
        )
    ).one()
    avg_quality = session.exec(
        select(func.avg(MetadataTable.quality_score)).where(
            MetadataTable.data_source_id == data_source_id
        )
    ).one()
    last_scanned: Any = session.exec(
        select(func.max(MetadataTable.last_scanned_at)).where(
            MetadataTable.data_source_id == data_source_id
        )
    ).one()
    column_count = session.exec(
        select(func.count(MetadataColumn.id))
        .join(MetadataTable, MetadataTable.id == MetadataColumn.metadata_table_id)
        .where(MetadataTable.data_source_id == data_source_id)
    ).one()
    avg_q = float(avg_quality) if isinstance(avg_quality, (Decimal, float, int)) else None
    return {
        "table_count": int(table_count or 0),
        "column_count": int(column_count or 0),
        "total_rows": int(total_rows or 0),
        "avg_quality_score": avg_q,
        "last_scanned_at": last_scanned,
    }


def search(
    session: Session,
    data_source_id: str,
    query: str,
    limit: int = 50,
) -> dict[str, Any]:
    """Find tables and columns whose names contain ``query`` (case-insensitive)."""
    needle = f"%{query.strip().lower()}%"
    if not query.strip():
        return {"tables": [], "columns": []}

    tables = session.exec(
        select(MetadataTable)
        .where(MetadataTable.data_source_id == data_source_id)
        .where(
            or_(
                func.lower(MetadataTable.table_name).like(needle),
                func.lower(func.coalesce(MetadataTable.schema_name, "")).like(needle),
            )
        )
        .order_by(MetadataTable.table_name)
        .limit(limit)
    ).all()

    columns = session.exec(
        select(MetadataColumn, MetadataTable)
        .join(MetadataTable, MetadataTable.id == MetadataColumn.metadata_table_id)
        .where(MetadataTable.data_source_id == data_source_id)
        .where(func.lower(MetadataColumn.column_name).like(needle))
        .order_by(MetadataTable.table_name, MetadataColumn.column_name)
        .limit(limit)
    ).all()

    column_hits: list[dict[str, Any]] = [
        {
            "id": col.id,
            "metadata_table_id": col.metadata_table_id,
            "column_name": col.column_name,
            "data_type": col.data_type,
            "table_name": tbl.table_name,
            "schema_name": tbl.schema_name,
        }
        for col, tbl in columns
    ]
    return {"tables": list(tables), "columns": column_hits}
