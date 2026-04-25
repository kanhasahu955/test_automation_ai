"""SQL template tests."""
from __future__ import annotations

from app.utils.sql_templates import render_validation_sql


def test_transformation_sql():
    sql = render_validation_sql(
        {
            "source_table": "customer_raw",
            "source_column": "first_name",
            "target_table": "dim_customer",
            "target_column": "customer_name",
            "join_key": "customer_id",
            "transformation_rule": "UPPER(first_name)",
            "validation_type": "TRANSFORMATION_CHECK",
        }
    )
    assert "FROM customer_raw s" in sql
    assert "JOIN dim_customer t" in sql
    assert "UPPER(s.first_name)" in sql
    assert "<>" in sql


def test_null_check_sql():
    sql = render_validation_sql(
        {
            "target_table": "dim_customer",
            "target_column": "email",
            "validation_type": "NULL_CHECK",
        }
    )
    assert "IS NULL" in sql
    assert "dim_customer" in sql
