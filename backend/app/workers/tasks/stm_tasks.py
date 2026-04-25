"""Async STM SQL validation runner."""
from __future__ import annotations

from sqlmodel import select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.modules.data_sources.models import DataSource
from app.modules.data_sources.service import build_engine_url_for_data
from app.modules.executions.models import ExecutionRun, ResultStatus, RunStatus, RunType
from app.modules.executions.service import append_result, update_run_status
from app.modules.sql_generator.models import GeneratedSqlTest
from app.modules.stm_converter.models import STMDocument, STMMapping
from app.utils.sql_safety import assert_safe_sql
from app.workers.db import task_session


@celery_app.task(name="stm.run_validation")
def run_stm_validation(stm_document_id: str, data_source_id: str | None,
                        triggered_by: str | None, allow_destructive: bool = False) -> dict:
    with task_session() as session:
        doc = session.exec(select(STMDocument).where(STMDocument.id == stm_document_id)).first()
        if not doc:
            return {"ok": False, "error": "STM doc not found"}

        run = ExecutionRun(
            project_id=doc.project_id,
            triggered_by=triggered_by,
            run_type=RunType.MANUAL,
            status=RunStatus.RUNNING,
        )
        session.add(run)
        session.commit()
        session.refresh(run)

        mappings = session.exec(
            select(STMMapping).where(STMMapping.stm_document_id == stm_document_id)
        ).all()
        mapping_ids = [m.id for m in mappings]
        sqls = session.exec(
            select(GeneratedSqlTest).where(GeneratedSqlTest.stm_mapping_id.in_(mapping_ids))
        ).all()
        run.total_tests = len(sqls)
        session.add(run)
        session.commit()

        ds = None
        if data_source_id:
            ds = session.exec(select(DataSource).where(DataSource.id == data_source_id)).first()

        for sql in sqls:
            try:
                assert_safe_sql(sql.sql_query, allow_destructive=allow_destructive)
            except ValueError as exc:
                append_result(session, run.id, status=ResultStatus.ERROR, error_message=str(exc))
                continue

            if not ds:
                append_result(
                    session, run.id, status=ResultStatus.SKIPPED,
                    logs="No data source attached; SQL not executed.",
                    result_json={"sql_id": sql.id},
                )
                continue
            url = build_engine_url_for_data(ds)
            if not url:
                append_result(
                    session, run.id, status=ResultStatus.SKIPPED,
                    error_message="Data source has no database name set",
                )
                continue
            try:
                from sqlalchemy import create_engine, text
                engine_ds = create_engine(url, pool_pre_ping=True)
                with engine_ds.connect() as conn:
                    rows = conn.execute(text(sql.sql_query)).fetchmany(settings.STM_VALIDATION_FETCH)
                row_count = len(rows)
                status = ResultStatus.PASSED if row_count == 0 else ResultStatus.FAILED
                append_result(
                    session, run.id, status=status,
                    result_json={"row_count": row_count, "sql_id": sql.id},
                    logs=f"Returned rows: {row_count}",
                )
            except Exception as exc:
                append_result(session, run.id, status=ResultStatus.ERROR, error_message=str(exc))

        run = session.exec(select(ExecutionRun).where(ExecutionRun.id == run.id)).first()
        final = RunStatus.PASSED if run and run.failed_tests == 0 else RunStatus.FAILED
        update_run_status(session, run.id, final, finished=True)
        return {"ok": True, "run_id": run.id, "status": final.value}
