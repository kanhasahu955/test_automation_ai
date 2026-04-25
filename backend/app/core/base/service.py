"""Service layer base class.

Provides:

* a per-class structured logger (``self.log``)
* a static ``name`` derived from the subclass for log scoping
* a place to declaratively wire repositories (subclasses just set attributes)

Services are **stateless across requests** but instances may carry composed
repositories. They take ``Session`` per call rather than capturing it, so the
same instance is safe to use from FastAPI deps and from Celery tasks.
"""
from __future__ import annotations

from typing import Any

from app.core.logger import get_logger


class BaseService:
    """Common parent for all module services.

    Subclasses get:
      * ``self.log`` — structlog logger named after the subclass.
      * ``self.bind(**ctx)`` — returns a logger with extra context (request id, user id…).
    """

    def __init__(self) -> None:
        self.log = get_logger(self.__class__.__module__)

    def bind(self, **context: Any) -> Any:
        """Return a new logger bound with extra context (read-only).

        Equivalent to ``self.log.bind(**context)`` but typed so callers don't
        accidentally mutate the service's logger.
        """
        return self.log.bind(**context)


__all__ = ["BaseService"]
