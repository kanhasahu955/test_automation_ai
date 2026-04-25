"""Centralized datetime helpers.

The application stores timestamps as **naive UTC** in MySQL because we use
`DATETIME` (not `TIMESTAMP`). Use :func:`utc_now_naive` everywhere a row is
written so values are stored consistently and can be compared without timezone
arithmetic.

For JWT/OAuth (where RFC requires aware UTC), use :func:`utc_now_aware`.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta


def utc_now_naive() -> datetime:
    """Return the current UTC time as a naive `datetime` (no tzinfo).

    Suitable for writing into MySQL `DATETIME` columns.
    """
    return datetime.now(UTC).replace(tzinfo=None)


def utc_now_aware() -> datetime:
    """Return the current UTC time as a timezone-aware `datetime`.

    Use for JWT `iat` / `exp`, refresh-token expiry math, and anywhere a
    library expects a tz-aware value.
    """
    return datetime.now(UTC)


def utc_naive_from(when: datetime) -> datetime:
    """Convert any (aware or naive) datetime to **naive UTC**."""
    if when.tzinfo is None:
        return when
    return when.astimezone(UTC).replace(tzinfo=None)


def utc_naive_offset(*, days: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
    """Return naive UTC `now + offset`."""
    return utc_now_naive() + timedelta(days=days, hours=hours, minutes=minutes)
