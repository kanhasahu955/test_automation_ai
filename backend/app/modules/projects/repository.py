"""Project repository — data access for the ``projects`` table."""
from __future__ import annotations

from sqlmodel import Session

from app.core.base import BaseRepository
from app.modules.projects.models import Project
from app.utils.pagination import PageParams


class ProjectRepository(BaseRepository[Project]):
    """Filterable, paginated access to projects."""

    model = Project

    def search(
        self,
        session: Session,
        params: PageParams,
        *,
        term: str | None = None,
    ) -> tuple[list[Project], int]:
        clauses = []
        if term:
            clauses.append(Project.name.ilike(f"%{term}%"))
        return self.list(
            session,
            params,
            where=clauses,
            order_by=Project.created_at.desc(),
        )


__all__ = ["ProjectRepository"]
