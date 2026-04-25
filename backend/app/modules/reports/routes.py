"""Reports routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user
from app.modules.reports import service
from app.modules.reports.schemas import (
    DashboardKPIs,
    QualityOverview,
    QualityScoreBreakdown,
    RegressionItem,
    TrendReport,
)
from app.modules.users.models import User

router = APIRouter(tags=["reports"])


@router.get("/projects/{project_id}/dashboard", response_model=DashboardKPIs)
def dashboard(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.dashboard(session, project_id)


@router.get("/projects/{project_id}/quality-score", response_model=QualityScoreBreakdown)
def quality_score(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.quality_score(session, project_id)


@router.get("/projects/{project_id}/trend-report", response_model=TrendReport)
def trend(
    project_id: str,
    days: int = 14,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return service.trend(session, project_id, days)


@router.get("/projects/{project_id}/quality-overview", response_model=QualityOverview)
def quality_overview(
    project_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Single-call snapshot for the home dashboard.

    Returns counts (test cases, executions, schedules), regression count,
    top failing tests and the most recent activity feed.
    """
    return service.overview(session, project_id)


@router.get("/projects/{project_id}/regressions", response_model=list[RegressionItem])
def regressions(
    project_id: str,
    limit: int = 50,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """List tests that **passed** in the previous finished run and **failed** in the latest one."""
    return service.regressions(session, project_id, limit=limit)
