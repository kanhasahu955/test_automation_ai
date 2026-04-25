"""Deterministic SQL template renderer for STM (Source-to-Target Mapping) validations.

This is the fallback path used when AI-driven SQL generation is disabled. The
actual SQL lives on disk in ``backend/sql/templates/stm/`` and is loaded via
:class:`app.utils.sql_loader.SqlLoader`. This module is the typed, validated
**business layer** on top of the loader.

Public entry points:

* :func:`render_validation_sql` — dict-in / SQL-out (kept for backwards compat
  with existing callers in :mod:`app.modules.stm_converter`).
* :class:`StmSqlRenderer`        — class-based, testable renderer with
  per-validation methods.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any

from app.utils.sql_loader import SqlLoader, sql_loader


class ValidationType(str, Enum):
    """All STM validation kinds the renderer knows about."""

    ROW_COUNT = "ROW_COUNT"
    NULL_CHECK = "NULL_CHECK"
    DUPLICATE_CHECK = "DUPLICATE_CHECK"
    REFERENCE_CHECK = "REFERENCE_CHECK"
    TRANSFORMATION_CHECK = "TRANSFORMATION_CHECK"

    @classmethod
    def coerce(cls, value: str | None) -> ValidationType:
        if not value:
            return cls.TRANSFORMATION_CHECK
        try:
            return cls(value.upper())
        except ValueError:
            return cls.TRANSFORMATION_CHECK


@dataclass(frozen=True, slots=True)
class StmMappingSpec:
    """Strongly-typed projection of an STM mapping row.

    Sensible defaults make this safe to construct from sparse user input;
    the renderer always sees populated string fields.
    """

    src_table: str
    tgt_table: str
    src_col: str
    tgt_col: str
    join_key: str
    transformation_rule: str
    validation_type: ValidationType

    @classmethod
    def from_dict(cls, mapping: dict[str, Any]) -> StmMappingSpec:
        return cls(
            src_table=str(mapping.get("source_table") or "source_table"),
            tgt_table=str(mapping.get("target_table") or "target_table"),
            src_col=str(mapping.get("source_column") or "src_col"),
            tgt_col=str(mapping.get("target_column") or "tgt_col"),
            join_key=str(mapping.get("join_key") or "id"),
            transformation_rule=str(mapping.get("transformation_rule") or "").strip(),
            validation_type=ValidationType.coerce(mapping.get("validation_type")),
        )


class StmSqlRenderer:
    """Render STM validation SQL by combining the typed spec + on-disk templates."""

    _IDENTIFIER_RE = re.compile(r"(?<![\w.])(?P<col>[A-Za-z_][A-Za-z0-9_]*)(?!\w)")

    def __init__(self, loader: SqlLoader = sql_loader) -> None:
        self._loader = loader

    # ------------------------------------------------------------------ public
    _TEMPLATE_PREFIX = "templates/stm"

    def render(self, spec: StmMappingSpec) -> str:
        match spec.validation_type:
            case ValidationType.ROW_COUNT:
                return self._render(
                    "row_count",
                    src_table=spec.src_table,
                    tgt_table=spec.tgt_table,
                )
            case ValidationType.NULL_CHECK:
                return self._render(
                    "null_check",
                    tgt_table=spec.tgt_table,
                    tgt_col=spec.tgt_col,
                )
            case ValidationType.DUPLICATE_CHECK:
                return self._render(
                    "duplicate_check",
                    tgt_table=spec.tgt_table,
                    tgt_col=spec.tgt_col,
                )
            case ValidationType.REFERENCE_CHECK:
                return self._render(
                    "reference_check",
                    src_table=spec.src_table,
                    tgt_table=spec.tgt_table,
                    join_key=spec.join_key,
                    tgt_col=spec.tgt_col,
                )
            case ValidationType.TRANSFORMATION_CHECK:
                return self._render(
                    "transformation_check",
                    src_table=spec.src_table,
                    tgt_table=spec.tgt_table,
                    join_key=spec.join_key,
                    tgt_col=spec.tgt_col,
                    expected=self._build_expected_expression(spec),
                )

    # ----------------------------------------------------------------- helpers
    def _render(self, template: str, **vars_: Any) -> str:
        return self._loader.render(f"{self._TEMPLATE_PREFIX}/{template}", **vars_).strip()

    def _build_expected_expression(self, spec: StmMappingSpec) -> str:
        """Compute the right-hand side of the equality used in TRANSFORMATION_CHECK.

        Rules:

        * Empty rule → use the source column qualified with ``s.``.
        * "Direct mapping"  → ``s.{src_col}``.
        * Already qualified → leave alone.
        * Otherwise          → qualify any bare reference to ``src_col``
          inside the rule (incl. inside function calls like ``UPPER(first_name)``).
        """
        rule = spec.transformation_rule
        if not rule:
            return f"s.{spec.src_col}"
        if rule.lower() == "direct mapping":
            return f"s.{spec.src_col}"
        if "s." in rule:
            return rule
        qualified = self._qualify_source_columns(rule, spec.src_col)
        if qualified == rule and "(" not in qualified:
            return f"s.{qualified}"
        return qualified

    @classmethod
    def _qualify_source_columns(cls, rule: str, src_col: str) -> str:
        """Prefix every bare reference to ``src_col`` with the alias ``s.``."""
        if not src_col:
            return rule
        pattern = re.compile(rf"(?<![\w.]){re.escape(src_col)}(?!\w)")
        return pattern.sub(f"s.{src_col}", rule)


# Module-level singleton — the public renderer.
_default_renderer = StmSqlRenderer()


def render_validation_sql(mapping: dict[str, Any]) -> str:
    """Backwards-compatible facade kept for existing callers and tests."""
    return _default_renderer.render(StmMappingSpec.from_dict(mapping))


__all__ = [
    "StmMappingSpec",
    "StmSqlRenderer",
    "ValidationType",
    "render_validation_sql",
]
