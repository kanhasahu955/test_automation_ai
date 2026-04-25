"""Airflow DAG: regression test pipeline.

Calls the QualityForge AI backend to trigger a suite run.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from airflow import DAG  # type: ignore
from airflow.operators.bash import BashOperator  # type: ignore

API_BASE = os.environ.get("QF_API_BASE", "http://backend:8000/api/v1")
SUITE_ID = os.environ.get("QF_SUITE_ID", "")
TOKEN = os.environ.get("QF_API_TOKEN", "")

default_args = {
    "owner": "qualityforge",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="qf_regression",
    description="QualityForge regression test pipeline",
    schedule="0 2 * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["qualityforge", "regression"],
) as dag:
    prepare_env = BashOperator(task_id="prepare_env", bash_command='echo "Preparing env"')
    trigger_run = BashOperator(
        task_id="trigger_suite_run",
        bash_command=(
            f'curl -X POST -H "Authorization: Bearer {TOKEN}" '
            f'-H "Content-Type: application/json" '
            f'-d \'{{"triggered_by_label":"airflow"}}\' '
            f"{API_BASE}/test-suites/{SUITE_ID}/run"
        ),
    )
    notify = BashOperator(task_id="notify", bash_command='echo "Run dispatched"')

    prepare_env >> trigger_run >> notify
