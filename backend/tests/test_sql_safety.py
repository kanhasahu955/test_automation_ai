"""SQL safety tests."""
from __future__ import annotations

import pytest

from app.utils.sql_safety import assert_safe_sql, is_destructive


def test_select_is_allowed():
    assert_safe_sql("SELECT * FROM users WHERE id = 1")


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM users",
        "DROP TABLE users",
        "TRUNCATE TABLE users",
        "UPDATE users SET name='x'",
        "ALTER TABLE users ADD COLUMN x INT",
    ],
)
def test_destructive_blocked(sql):
    assert is_destructive(sql)
    with pytest.raises(ValueError):
        assert_safe_sql(sql)


def test_destructive_can_be_explicitly_allowed():
    assert_safe_sql("DELETE FROM users", allow_destructive=True)
