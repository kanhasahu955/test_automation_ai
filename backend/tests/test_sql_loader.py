"""SqlLoader unit tests."""
from __future__ import annotations

from pathlib import Path

import pytest

from app.utils.sql_loader import SqlLoader, SqlTemplateError, SqlTemplateNotFound


def _make_loader(tmp_path: Path) -> SqlLoader:
    loader = SqlLoader(tmp_path)
    return loader


def test_load_returns_file_contents(tmp_path: Path):
    (tmp_path / "ping.sql").write_text("SELECT 1;\n", encoding="utf-8")
    loader = _make_loader(tmp_path)
    assert loader.load("ping").strip() == "SELECT 1;"


def test_render_substitutes_placeholders(tmp_path: Path):
    (tmp_path / "q.sql").write_text("SELECT * FROM {table} WHERE id = {id};", encoding="utf-8")
    loader = _make_loader(tmp_path)
    assert loader.render("q", table="users", id=42) == "SELECT * FROM users WHERE id = 42;"


def test_missing_placeholder_fails_loudly(tmp_path: Path):
    (tmp_path / "q.sql").write_text("SELECT {missing} FROM t;", encoding="utf-8")
    loader = _make_loader(tmp_path)
    with pytest.raises(SqlTemplateError) as ei:
        loader.render("q")
    assert "missing" in str(ei.value)


def test_missing_file_raises_not_found(tmp_path: Path):
    loader = _make_loader(tmp_path)
    with pytest.raises(SqlTemplateNotFound):
        loader.load("does/not/exist")


def test_path_escape_blocked(tmp_path: Path):
    loader = _make_loader(tmp_path)
    with pytest.raises(SqlTemplateError):
        loader.load("../../etc/passwd")


def test_cache_returns_same_string(tmp_path: Path):
    target = tmp_path / "x.sql"
    target.write_text("SELECT 1;", encoding="utf-8")
    loader = _make_loader(tmp_path)
    first = loader.load("x")
    target.write_text("SELECT 2;", encoding="utf-8")
    cached = loader.load("x")
    assert first == cached
    loader.clear_cache()
    assert loader.load("x").strip() == "SELECT 2;"
