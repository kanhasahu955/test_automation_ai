"""Generic pagination helpers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")


@dataclass
class PageParams:
    page: int
    size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size

    @property
    def limit(self) -> int:
        return self.size


def page_params(
    page: int = Query(1, ge=1, le=10_000),
    size: int = Query(20, ge=1, le=200),
) -> PageParams:
    return PageParams(page=page, size=size)


class Page(BaseModel, Generic[T]):
    items: list[T]
    page: int
    size: int
    total: int
    pages: int


def total_pages(total: int, size: int) -> int:
    """Compute total page count from `total` items and a `size` page size."""
    if size <= 0:
        return 1
    return max(1, (total + size - 1) // size)


def page_of(items: list[T], total: int, params: PageParams) -> Page[T]:
    """Wrap a (slice, total) into a :class:`Page` for response models.

    Removes the duplicated ``Page(items=..., total=..., pages=max(1, ...))``
    arithmetic across list endpoints.
    """
    return Page[T](
        items=items,
        page=params.page,
        size=params.size,
        total=total,
        pages=total_pages(total, params.size),
    )
