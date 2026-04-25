"""STM Excel parser using pandas/openpyxl."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

EXPECTED_COLUMNS = {
    "source_table": ["source table", "source_table", "src_table"],
    "source_column": ["source column", "source_column", "src_column"],
    "target_table": ["target table", "target_table", "tgt_table"],
    "target_column": ["target column", "target_column", "tgt_column"],
    "join_key": ["join key", "join_key"],
    "transformation_rule": ["transformation rule", "transformation_rule", "rule"],
    "validation_type": ["validation type", "validation_type", "type"],
}


def _normalize_column(name: str) -> str:
    return str(name).strip().lower().replace("\n", " ").replace("  ", " ")


def parse_stm_excel(path: str | Path) -> list[dict[str, Any]]:
    """Parse an Excel STM workbook into a list of mapping dictionaries."""
    df = pd.read_excel(path, engine="openpyxl")
    df.columns = [_normalize_column(c) for c in df.columns]

    column_map: dict[str, str] = {}
    for canonical, aliases in EXPECTED_COLUMNS.items():
        for alias in aliases:
            if alias in df.columns:
                column_map[canonical] = alias
                break

    records: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        record = {key: (str(row[col]).strip() if col in df.columns and pd.notna(row[col]) else None)
                  for key, col in column_map.items()}
        if not record.get("source_table") and not record.get("target_table"):
            continue
        records.append(record)
    return records
