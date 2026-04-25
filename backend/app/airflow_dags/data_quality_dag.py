"""Airflow DAG: data quality pipeline."""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from airflow import DAG  # type: ignore
from airflow.operators.bash import BashOperator  # type: ignore

API_BASE = os.environ.get("QF_API_BASE", "http://backend:8000/api/v1")
DATA_SOURCE_ID = os.environ.get("QF_DATA_SOURCE_ID", "")
TOKEN = os.environ.get("QF_API_TOKEN", "")

default_args = {"owner": "qualityforge", "retries": 1, "retry_delay": timedelta(minutes=5)}

with DAG(
    dag_id="qf_data_quality",
    description="QualityForge data quality pipeline",
    schedule="0 4 * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["qualityforge", "data-quality"],
) as dag:
    scan_metadata = BashOperator(
        task_id="scan_metadata",
        bash_command=(
            f'curl -X POST -H "Authorization: Bearer {TOKEN}" '
            f"{API_BASE}/data-sources/{DATA_SOURCE_ID}/scan-metadata"
        ),
    )
    profile_data = BashOperator(
        task_id="profile_data",
        bash_command=(
            f'curl -X POST -H "Authorization: Bearer {TOKEN}" '
            f"{API_BASE}/data-sources/{DATA_SOURCE_ID}/profile"
        ),
    )
    notify = BashOperator(task_id="notify", bash_command='echo "Data quality run completed"')

    scan_metadata >> profile_data >> notify
