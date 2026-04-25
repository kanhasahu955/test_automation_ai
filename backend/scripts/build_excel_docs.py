"""Build all QualityForge AI Excel deliverables in one go.

Run:
    cd backend
    uv run python -m scripts.build_excel_docs

Outputs three files under `docs/excel/`:

    1. qualityforge-ai_api_reference.xlsx        — full API documentation
    2. qualityforge-ai_stm_upload_template.xlsx  — STM mapping upload template
    3. qualityforge-ai_schedule_executions.xlsx  — schedule execution template
"""
from __future__ import annotations

import argparse
from pathlib import Path

from scripts.build_api_workbook import build as build_api
from scripts.build_schedule_workbook import build as build_schedule
from scripts.build_stm_workbook import build as build_stm


def build_all(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = [
        build_api(out_dir / "qualityforge-ai_api_reference.xlsx"),
        build_stm(out_dir / "qualityforge-ai_stm_upload_template.xlsx"),
        build_schedule(out_dir / "qualityforge-ai_schedule_executions.xlsx"),
    ]
    return paths


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "docs" / "excel",
        help="Directory to write the .xlsx files into (default: <repo>/docs/excel)",
    )
    args = parser.parse_args()

    paths = build_all(args.out)
    print("\nGenerated:")
    for p in paths:
        print(f"  • {p}  ({p.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
