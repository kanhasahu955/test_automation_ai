"""Airflow DAG: STM validation pipeline."""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from airflow import DAG  # type: ignore
from airflow.operators.bash import BashOperator  # type: ignore

API_BASE = os.environ.get("QF_API_BASE", "http://backend:8000/api/v1")
STM_DOC_ID = os.environ.get("QF_STM_DOC_ID", "")
DATA_SOURCE_ID = os.environ.get("QF_DATA_SOURCE_ID", "")
TOKEN = os.environ.get("QF_API_TOKEN", "")

default_args = {"owner": "qualityforge", "retries": 1, "retry_delay": timedelta(minutes=5)}

with DAG(
    dag_id="qf_stm_validation",
    description="QualityForge STM validation pipeline",
    schedule="0 3 * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["qualityforge", "stm"],
) as dag:
    run_validation = BashOperator(
        task_id="run_stm_validation",
        bash_command=(
            f'curl -X POST -H "Authorization: Bearer {TOKEN}" '
            f'-H "Content-Type: application/json" '
            f'-d \'{{"data_source_id":"{DATA_SOURCE_ID}"}}\' '
            f"{API_BASE}/stm/{STM_DOC_ID}/run-validation"
        ),
    )
