"""Unit tests for the schedules cron-builder utility."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.errors import ValidationFailed
from app.modules.schedules import cron
from app.modules.schedules.schemas import (
    CustomCadence,
    DailyCadence,
    HourlyCadence,
    MonthlyCadence,
    WeeklyCadence,
)


def test_hourly_renders_correct_cron():
    assert cron.cadence_to_cron(HourlyCadence(minute=15)) == "15 * * * *"


def test_daily_renders_correct_cron():
    assert cron.cadence_to_cron(DailyCadence(hour=2, minute=30)) == "30 2 * * *"


def test_weekly_renders_sorted_unique_dows():
    cad = WeeklyCadence(hour=9, minute=0, days_of_week=[5, 1, 1, 3])
    assert cron.cadence_to_cron(cad) == "0 9 * * 1,3,5"


def test_weekly_rejects_empty_dow():
    with pytest.raises(ValidationError):
        WeeklyCadence(days_of_week=[])


def test_weekly_rejects_out_of_range_dow():
    with pytest.raises(ValidationError):
        WeeklyCadence(days_of_week=[7])


def test_monthly_renders_correct_cron():
    assert cron.cadence_to_cron(MonthlyCadence(day_of_month=15, hour=4, minute=5)) == "5 4 15 * *"


def test_custom_passes_through_valid_expression():
    assert cron.cadence_to_cron(CustomCadence(expression="*/5 * * * *")) == "*/5 * * * *"


def test_custom_rejects_invalid_expression():
    with pytest.raises(ValidationFailed):
        cron.cadence_to_cron(CustomCadence(expression="not a cron"))


def test_next_runs_returns_requested_count():
    runs = cron.next_runs("0 * * * *", "UTC", count=3)
    assert len(runs) == 3
    # Every fire is at minute 0.
    assert all(r.minute == 0 and r.second == 0 for r in runs)


def test_next_runs_respects_timezone_difference():
    """Fires at local 2:00 — UTC offsets should differ for IST vs UTC."""
    utc_runs = cron.next_runs("0 2 * * *", "UTC", count=1)
    ist_runs = cron.next_runs("0 2 * * *", "Asia/Kolkata", count=1)
    assert utc_runs[0].hour == 2
    # 02:00 IST == 20:30 UTC
    assert ist_runs[0].hour == 20
    assert ist_runs[0].minute == 30


def test_description_for_each_cadence():
    assert "hour" in cron.cadence_description(HourlyCadence(minute=0)).lower()
    assert "day" in cron.cadence_description(DailyCadence()).lower()
    assert "Monday" in cron.cadence_description(WeeklyCadence(days_of_week=[1]))
    assert "month" in cron.cadence_description(MonthlyCadence()).lower()
    assert cron.cadence_description(CustomCadence(expression="*/5 * * * *")).startswith("Custom")


def test_invalid_cron_for_next_runs_raises():
    with pytest.raises(ValidationFailed):
        cron.next_runs("not a cron", "UTC", count=1)
