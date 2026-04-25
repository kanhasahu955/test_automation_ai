"""Celery tasks for executing flows / suites."""
from __future__ import annotations

import time

from sqlmodel import Session, select

from app.core.celery_app import celery_app
from app.modules.executions.models import (
    ExecutionRun,
    ResultStatus,
    RunStatus,
)
from app.modules.executions.service import append_result, update_run_status
from app.modules.no_code_flows.compiler import compile_flow
from app.modules.no_code_flows.models import NoCodeFlow
from app.modules.test_suites.models import TestSuiteCase
from app.workers.db import task_session


@celery_app.task(name="execution.run", bind=True, max_retries=2)
def run_execution(self, run_id: str, kind: str) -> dict:
    with task_session() as session:
        run = session.exec(select(ExecutionRun).where(ExecutionRun.id == run_id)).first()
        if not run:
            return {"ok": False, "error": "run not found"}

        update_run_status(session, run_id, RunStatus.RUNNING)

        if kind == "flow" and run.flow_id:
            _run_flow(session, run.id, run.flow_id)
        elif kind == "suite" and run.suite_id:
            _run_suite(session, run.id, run.suite_id)
        else:
            run = update_run_status(session, run_id, RunStatus.CANCELLED, finished=True)
            return {"ok": False, "error": "invalid run kind"}

        run = session.exec(select(ExecutionRun).where(ExecutionRun.id == run_id)).first()
        final = RunStatus.PASSED if (run and run.failed_tests == 0) else RunStatus.FAILED
        update_run_status(session, run_id, final, finished=True)
        return {"ok": True, "run_id": run_id, "status": final.value}


def _run_flow(session: Session, run_id: str, flow_id: str) -> None:
    flow = session.exec(select(NoCodeFlow).where(NoCodeFlow.id == flow_id)).first()
    if not flow:
        append_result(session, run_id, status=ResultStatus.ERROR, error_message="Flow not found")
        return
    started = time.time()
    try:
        script, warnings = compile_flow(flow.flow_json, flow.runtime)
        # Compilation success counts as passed in this scaffold.
        append_result(
            session, run_id,
            flow_id=flow.id,
            status=ResultStatus.PASSED,
            duration_ms=int((time.time() - started) * 1000),
            logs="Compilation OK\n" + "\n".join(warnings),
            result_json={"runtime": flow.runtime.value, "warnings": warnings, "script_chars": len(script)},
        )
    except Exception as exc:
        append_result(
            session, run_id,
            flow_id=flow.id,
            status=ResultStatus.FAILED,
            duration_ms=int((time.time() - started) * 1000),
            error_message=str(exc),
        )


def _run_suite(session: Session, run_id: str, suite_id: str) -> None:
    cases = session.exec(
        select(TestSuiteCase).where(TestSuiteCase.suite_id == suite_id).order_by(TestSuiteCase.execution_order)
    ).all()
    if not cases:
        append_result(session, run_id, status=ResultStatus.SKIPPED, error_message="Suite has no cases")
        return
    for case in cases:
        started = time.time()
        # In this scaffold, manual cases are recorded as passed; integrate runner when wiring real execution.
        append_result(
            session, run_id,
            test_case_id=case.test_case_id,
            status=ResultStatus.PASSED,
            duration_ms=int((time.time() - started) * 1000),
            logs="Suite case executed (scaffold)",
        )
