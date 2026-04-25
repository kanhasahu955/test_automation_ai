"""Read & render SQL templates from ``backend/sql/`` on disk.

This is the **only** entry point that should ever touch the ``sql/`` folder.
Files are cached in-process after first read; in development you can call
:meth:`SqlLoader.clear_cache` (or restart the server) after editing a template.

Usage
-----
::

    from app.utils.sql_loader import sql_loader

    sql = sql_loader.render("stm/row_count", src_table="customer_raw", tgt_table="dim_customer")

Placeholder syntax is plain ``str.format_map`` — single braces, no Jinja. Any
literal ``{`` / ``}`` in your SQL must be doubled (``{{`` / ``}}``).

Missing files raise :class:`SqlTemplateNotFound`; missing placeholders raise
:class:`SqlTemplateError` so issues surface during development, never silently.
"""
from __future__ import annotations

from pathlib import Path
from threading import RLock
from typing import Any


class SqlTemplateError(RuntimeError):
    """Generic SQL template rendering error."""


class SqlTemplateNotFound(SqlTemplateError):
    """Raised when a template path can't be resolved on disk."""


class SqlLoader:
    """Filesystem-backed SQL template loader with a thread-safe in-process cache."""

    DEFAULT_EXT = ".sql"

    def __init__(self, base_dir: Path | str) -> None:
        self._base_dir = Path(base_dir).resolve()
        self._cache: dict[str, str] = {}
        self._lock = RLock()

    @property
    def base_dir(self) -> Path:
        return self._base_dir

    def _resolve(self, name: str) -> Path:
        rel = name if name.endswith(self.DEFAULT_EXT) else f"{name}{self.DEFAULT_EXT}"
        path = (self._base_dir / rel).resolve()
        try:
            path.relative_to(self._base_dir)
        except ValueError as exc:
            raise SqlTemplateError(f"SQL path escapes sql/: {name}") from exc
        if not path.is_file():
            raise SqlTemplateNotFound(
                f"SQL template not found: {rel} (looked in {self._base_dir})"
            )
        return path

    def load(self, name: str) -> str:
        """Return the raw SQL string for ``name``. Cached after first read."""
        with self._lock:
            cached = self._cache.get(name)
            if cached is not None:
                return cached
            sql = self._resolve(name).read_text(encoding="utf-8")
            self._cache[name] = sql
            return sql

    def render(self, name: str, /, **variables: Any) -> str:
        """Load template ``name`` and substitute ``{placeholder}`` values."""
        template = self.load(name)
        try:
            return template.format_map(_StrictMap(variables))
        except _MissingPlaceholder as exc:
            raise SqlTemplateError(
                f"Missing placeholder '{exc.key}' rendering SQL template '{name}'"
            ) from exc
        except (KeyError, IndexError) as exc:
            raise SqlTemplateError(
                f"Failed to render SQL template '{name}': {exc}"
            ) from exc

    def clear_cache(self) -> None:
        """Drop the in-process cache. Useful in development/tests after editing files."""
        with self._lock:
            self._cache.clear()


class _MissingPlaceholder(KeyError):
    def __init__(self, key: str) -> None:
        super().__init__(key)
        self.key = key


class _StrictMap(dict):
    """``dict`` subclass that fails fast on missing keys with a typed error."""

    def __missing__(self, key: str) -> Any:
        raise _MissingPlaceholder(key)


# ---------------------------------------------------------------------------
# Default singleton (resolves backend/sql at import time).
# ---------------------------------------------------------------------------
_DEFAULT_SQL_DIR = Path(__file__).resolve().parents[2] / "sql"
sql_loader = SqlLoader(_DEFAULT_SQL_DIR)


__all__ = [
    "SqlLoader",
    "SqlTemplateError",
    "SqlTemplateNotFound",
    "sql_loader",
]
