"""Cron-from-cadence translation + validation + next-run computation.

The frontend's *Schedule Builder* posts a structured ``Cadence`` (Hourly /
Daily / Weekly / Monthly / Custom). This module turns that into the exact
5-field cron expression we hand to RedBeat, validates it, and produces a
human description plus the next *N* fire times so the UI can preview the
schedule before the user clicks "Save".

Why centralise here:

* Identical preset semantics on both sides — frontend cadence builder and
  backend persistence agree byte-for-byte on the cron string.
* All ``croniter`` usage lives in one place; the rest of the codebase only
  sees plain ``datetime`` instances.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from croniter import croniter  # type: ignore[import-untyped,unused-ignore]

from app.core.errors import ValidationFailed
from app.modules.schedules.models import CadenceKind
from app.modules.schedules.schemas import (
    Cadence,
    CustomCadence,
    DailyCadence,
    HourlyCadence,
    MonthlyCadence,
    WeeklyCadence,
)

# ---------------------------------------------------------------------------
# Cadence → cron
# ---------------------------------------------------------------------------
_DOW_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def cadence_to_cron(cadence: Cadence) -> str:
    """Render a ``Cadence`` to its canonical 5-field cron string.

    Raises :class:`ValidationFailed` if the cadence cannot be expressed.
    """
    if isinstance(cadence, HourlyCadence):
        return f"{cadence.minute} * * * *"

    if isinstance(cadence, DailyCadence):
        return f"{cadence.minute} {cadence.hour} * * *"

    if isinstance(cadence, WeeklyCadence):
        dow = ",".join(str(d) for d in cadence.days_of_week)
        return f"{cadence.minute} {cadence.hour} * * {dow}"

    if isinstance(cadence, MonthlyCadence):
        return f"{cadence.minute} {cadence.hour} {cadence.day_of_month} * *"

    if isinstance(cadence, CustomCadence):
        # ``croniter`` validates the expression and raises ``CroniterBadCronError``.
        try:
            croniter(cadence.expression)
        except Exception as exc:
            raise ValidationFailed(f"Invalid cron expression: {exc}") from exc
        return cadence.expression.strip()

    raise ValidationFailed("Unknown cadence kind")


def cadence_config(cadence: Cadence) -> dict[str, Any]:
    """Return a JSON-serialisable snapshot of the cadence for round-tripping."""
    return cadence.model_dump(mode="json")


def cadence_kind(cadence: Cadence) -> CadenceKind:
    return cadence.kind


# ---------------------------------------------------------------------------
# Description (server-side; frontend has its own pretty-printer too)
# ---------------------------------------------------------------------------
def cadence_description(cadence: Cadence) -> str:
    """Return a short human-readable summary of the cadence."""
    if isinstance(cadence, HourlyCadence):
        return f"Every hour at minute {cadence.minute:02d}"

    if isinstance(cadence, DailyCadence):
        return f"Every day at {cadence.hour:02d}:{cadence.minute:02d}"

    if isinstance(cadence, WeeklyCadence):
        days = ", ".join(_DOW_NAME[d] for d in cadence.days_of_week)
        return f"Every week on {days} at {cadence.hour:02d}:{cadence.minute:02d}"

    if isinstance(cadence, MonthlyCadence):
        return (
            f"Every month on day {cadence.day_of_month} "
            f"at {cadence.hour:02d}:{cadence.minute:02d}"
        )

    if isinstance(cadence, CustomCadence):
        return f"Custom cron: {cadence.expression}"

    return "Custom schedule"


# ---------------------------------------------------------------------------
# Next-run computation
# ---------------------------------------------------------------------------
def _resolve_tz(name: str):
    """Resolve a tz name to a tzinfo, falling back to UTC if invalid."""
    if not name or name.upper() == "UTC":
        return UTC
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return UTC


def next_runs(cron_expression: str, timezone: str = "UTC", count: int = 5) -> list[datetime]:
    """Return the next ``count`` fire times in UTC.

    The cron expression is interpreted in the schedule's timezone, but we
    return UTC datetimes so the rest of the system stores a single
    canonical clock.
    """
    if count <= 0:
        return []
    tz = _resolve_tz(timezone)
    base_local = datetime.now(tz)
    try:
        itr = croniter(cron_expression, base_local)
    except Exception as exc:
        raise ValidationFailed(f"Invalid cron expression: {exc}") from exc
    result: list[datetime] = []
    for _ in range(count):
        local_next = itr.get_next(datetime)
        if local_next.tzinfo is None:
            local_next = local_next.replace(tzinfo=tz)
        result.append(local_next.astimezone(UTC))
    return result


def next_run_at(cron_expression: str, timezone: str = "UTC") -> datetime | None:
    runs = next_runs(cron_expression, timezone, count=1)
    return runs[0] if runs else None
