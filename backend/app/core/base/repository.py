"""Generic SQLModel repository.

Encapsulates the boilerplate every module re-implements:

* lookup by id (raises :class:`NotFoundError`)
* paginated list with optional filtering callable
* create / update / delete with explicit commit + refresh

Subclass it like::

    class ProjectRepository(BaseRepository[Project]):
        model = Project

        def search_by_name(self, session: Session, term: str) -> list[Project]:
            ...

The repository is intentionally **stateless** w.r.t. the session — every method
takes a ``Session``. This keeps it Celery-friendly and trivially testable.
"""
from __future__ import annotations

from typing import Any, ClassVar, Generic, TypeVar

from sqlmodel import Session, SQLModel, func, select

from app.core.errors import NotFoundError
from app.utils.pagination import PageParams

ModelT = TypeVar("ModelT", bound=SQLModel)


class BaseRepository(Generic[ModelT]):
    """Generic CRUD repository for a SQLModel table.

    Subclasses must set the :attr:`model` class attribute. ``id_field`` defaults
    to ``"id"`` but can be overridden for tables whose PK column has a different
    name.
    """

    model: ClassVar[type[SQLModel]]
    id_field: ClassVar[str] = "id"

    # ------------------------------------------------------------------ helpers
    def _id_column(self) -> Any:
        return getattr(self.model, self.id_field)

    def _not_found(self, identifier: Any) -> NotFoundError:
        return NotFoundError(f"{self.model.__name__} not found: {identifier}")

    # ------------------------------------------------------------------ public
    def get(self, session: Session, identifier: Any) -> ModelT | None:
        """Return entity by id or ``None``."""
        row = session.exec(
            select(self.model).where(self._id_column() == identifier)
        ).first()
        return row  # type: ignore[return-value]

    def get_or_404(self, session: Session, identifier: Any) -> ModelT:
        """Return entity by id; raise :class:`NotFoundError` if it doesn't exist."""
        row = self.get(session, identifier)
        if row is None:
            raise self._not_found(identifier)
        return row

    def list(
        self,
        session: Session,
        params: PageParams,
        *,
        where: list[Any] | None = None,
        order_by: Any | None = None,
    ) -> tuple[list[ModelT], int]:
        """Return ``(items, total)`` matching optional ``where`` clauses."""
        query = select(self.model)
        count_query = select(func.count()).select_from(self.model)
        for clause in where or []:
            query = query.where(clause)
            count_query = count_query.where(clause)
        if order_by is not None:
            query = query.order_by(order_by)
        total = session.exec(count_query).one()
        items = session.exec(query.offset(params.offset).limit(params.limit)).all()
        return list(items), int(total)  # type: ignore[arg-type]

    def create(self, session: Session, instance: ModelT, *, commit: bool = True) -> ModelT:
        session.add(instance)
        if commit:
            session.commit()
            session.refresh(instance)
        return instance

    def update(
        self,
        session: Session,
        instance: ModelT,
        changes: dict[str, Any],
        *,
        commit: bool = True,
    ) -> ModelT:
        for key, value in changes.items():
            setattr(instance, key, value)
        session.add(instance)
        if commit:
            session.commit()
            session.refresh(instance)
        return instance

    def delete(self, session: Session, instance: ModelT, *, commit: bool = True) -> None:
        session.delete(instance)
        if commit:
            session.commit()


__all__ = ["BaseRepository", "ModelT"]
