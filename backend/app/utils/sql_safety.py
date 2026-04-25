"""SQL safety checks: block destructive statements unless explicitly allowed."""
from __future__ import annotations

import re

DESTRUCTIVE_PATTERNS = [
    r"\bDROP\b",
    r"\bDELETE\b",
    r"\bTRUNCATE\b",
    r"\bALTER\b",
    r"\bUPDATE\b",
    r"\bINSERT\b",
    r"\bGRANT\b",
    r"\bREVOKE\b",
    r"\bCREATE\b",
    r"\bRENAME\b",
]

DESTRUCTIVE_RE = re.compile("|".join(DESTRUCTIVE_PATTERNS), re.IGNORECASE)


def is_destructive(sql: str) -> bool:
    return bool(DESTRUCTIVE_RE.search(sql or ""))


def assert_safe_sql(sql: str, allow_destructive: bool = False) -> None:
    if not allow_destructive and is_destructive(sql):
        raise ValueError(
            "Destructive SQL detected. Only SELECT statements are allowed by default."
        )
