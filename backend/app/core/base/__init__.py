"""Foundational OOP building blocks shared by every module.

* :class:`BaseRepository` — generic CRUD for any SQLModel table.
* :class:`BaseService`    — opinionated Service base with logger + session lifecycle.

Modules are expected to subclass these instead of writing free functions, so we
get one canonical place to add cross-cutting behaviour (metrics, audit, retries…).
"""
from app.core.base.repository import BaseRepository
from app.core.base.service import BaseService

__all__ = ["BaseRepository", "BaseService"]
