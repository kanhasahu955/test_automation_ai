"""Convenience constructors for the common :mod:`app.core.errors` shapes.

Use these helpers in services to keep error messages and codes consistent
across the API. They wrap :class:`app.core.errors.NotFoundError`,
:class:`ConflictError` and :class:`ValidationFailed` so call sites stay terse.
"""
from __future__ import annotations

from app.core.errors import ConflictError, NotFoundError, ValidationFailed


def not_found(resource: str, *, id: str | None = None) -> NotFoundError:
    """Build a uniform 404 error.

    Examples
    --------
    >>> raise not_found("Project")
    NotFoundError: Project not found
    >>> raise not_found("Test case", id="abc")
    NotFoundError: Test case (id=abc) not found
    """
    msg = f"{resource} (id={id}) not found" if id else f"{resource} not found"
    return NotFoundError(msg, extra={"resource": resource, "id": id} if id else {"resource": resource})


def conflict(message: str, *, code: str | None = None) -> ConflictError:
    """Build a uniform 409 error."""
    return ConflictError(message, code=code or "conflict")


def invalid(message: str, *, field: str | None = None) -> ValidationFailed:
    """Build a uniform 422 error scoped to a field if provided."""
    extra = {"field": field} if field else None
    return ValidationFailed(message, extra=extra)
