"""Project service — class-based business logic over :class:`ProjectRepository`."""
from __future__ import annotations

from sqlmodel import Session

from app.core.base import BaseService
from app.modules.projects.models import Project
from app.modules.projects.repository import ProjectRepository
from app.modules.projects.schemas import ProjectCreate, ProjectUpdate
from app.utils.pagination import PageParams


class ProjectService(BaseService):
    """All write paths go through this single class for easy auditing."""

    def __init__(self, repo: ProjectRepository | None = None) -> None:
        super().__init__()
        self._repo = repo or ProjectRepository()

    def create(self, session: Session, payload: ProjectCreate, *, owner_id: str) -> Project:
        project = Project(
            name=payload.name,
            description=payload.description,
            owner_id=owner_id,
        )
        self._repo.create(session, project)
        self.log.info("project.created", project_id=project.id, owner_id=owner_id)
        return project

    def get(self, session: Session, project_id: str) -> Project:
        return self._repo.get_or_404(session, project_id)

    def list(
        self,
        session: Session,
        params: PageParams,
        search: str | None = None,
    ) -> tuple[list[Project], int]:
        return self._repo.search(session, params, term=search)

    def update(
        self, session: Session, project_id: str, payload: ProjectUpdate
    ) -> Project:
        project = self.get(session, project_id)
        changes = payload.model_dump(exclude_unset=True)
        if not changes:
            return project
        return self._repo.update(session, project, changes)

    def delete(self, session: Session, project_id: str) -> None:
        project = self.get(session, project_id)
        self._repo.delete(session, project)
        self.log.info("project.deleted", project_id=project_id)


# Module-level singleton.
project_service = ProjectService()


# ---------------------------------------------------------------------------
# Back-compat function-style shims used by existing routes/tests.
# ---------------------------------------------------------------------------
def create_project(session: Session, payload: ProjectCreate, owner_id: str) -> Project:
    return project_service.create(session, payload, owner_id=owner_id)


def get_project(session: Session, project_id: str) -> Project:
    return project_service.get(session, project_id)


def list_projects(
    session: Session,
    params: PageParams,
    search: str | None = None,
) -> tuple[list[Project], int]:
    return project_service.list(session, params, search)


def update_project(session: Session, project_id: str, payload: ProjectUpdate) -> Project:
    return project_service.update(session, project_id, payload)


def delete_project(session: Session, project_id: str) -> None:
    project_service.delete(session, project_id)


__all__ = [
    "ProjectService",
    "create_project",
    "delete_project",
    "get_project",
    "list_projects",
    "project_service",
    "update_project",
]
