"""Tests for the metadata discovery helpers (summary + search)."""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

# Importing the dependent model attaches it to SQLModel.metadata so the FK
# from `metadata_tables.data_source_id` -> `data_sources.id` can be resolved
# when create_all() runs in the in-memory engine.
from app.modules.data_sources.models import DataSource  # noqa: F401
from app.modules.metadata import service as metadata_service
from app.modules.metadata.models import MetadataColumn, MetadataTable
from app.modules.projects.models import Project  # noqa: F401  (FK target)


def _make_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _seed(session: Session, ds_id: str = "ds-1") -> None:
    table_a = MetadataTable(
        id="t1",
        data_source_id=ds_id,
        table_name="customers",
        schema_name="public",
        row_count=100,
        quality_score=Decimal("0.80"),
    )
    table_b = MetadataTable(
        id="t2",
        data_source_id=ds_id,
        table_name="orders",
        schema_name="public",
        row_count=1000,
        quality_score=Decimal("0.60"),
    )
    other = MetadataTable(
        id="t3",
        data_source_id="other-ds",
        table_name="users",
        row_count=42,
    )
    session.add_all([table_a, table_b, other])

    session.add_all(
        [
            MetadataColumn(
                id="c1",
                metadata_table_id="t1",
                column_name="customer_id",
                data_type="INT",
                is_primary_key=True,
            ),
            MetadataColumn(
                id="c2",
                metadata_table_id="t1",
                column_name="email",
                data_type="VARCHAR",
            ),
            MetadataColumn(
                id="c3",
                metadata_table_id="t2",
                column_name="customer_id",
                data_type="INT",
                is_foreign_key=True,
            ),
        ]
    )
    session.commit()


def test_summary_aggregates_only_target_data_source() -> None:
    with _make_session() as session:
        _seed(session)
        summary = metadata_service.get_summary(session, "ds-1")

    assert summary["table_count"] == 2
    assert summary["column_count"] == 3
    assert summary["total_rows"] == 1100
    assert summary["avg_quality_score"] is not None
    assert 0.0 <= float(summary["avg_quality_score"]) <= 1.0


def test_search_finds_tables_and_columns() -> None:
    with _make_session() as session:
        _seed(session)
        results = metadata_service.search(session, "ds-1", "customer")

    table_ids = {t.id for t in results["tables"]}
    column_ids = {c["id"] for c in results["columns"]}
    # Table named "customers" matches on table_name
    assert "t1" in table_ids
    # Both `customer_id` columns should match
    assert column_ids == {"c1", "c3"}
    # Other-ds table must not leak in
    assert "t3" not in table_ids


def test_search_blank_query_returns_empty() -> None:
    with _make_session() as session:
        _seed(session)
        results = metadata_service.search(session, "ds-1", "   ")
    assert results == {"tables": [], "columns": []}
