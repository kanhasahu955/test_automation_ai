"""AI generation service. Uses OpenAI when configured; otherwise deterministic fallback."""
from __future__ import annotations

import json
import re
from typing import Any

from sqlmodel import Session

from app.core.config import settings
from app.core.logger import get_logger
from app.modules.ai_generator.models import AIPromptHistory, PromptType
from app.modules.ai_generator.prompts import (
    ANALYZE_FAILURE,
    GENERATE_NO_CODE_FLOW,
    GENERATE_SQL_FROM_STM,
    GENERATE_STM_SCENARIOS,
    GENERATE_TEST_CASES,
    SUGGEST_EDGE_CASES,
)
from app.utils.sql_templates import render_validation_sql

log = get_logger("ai")


def _has_openai() -> bool:
    return bool(settings.AI_ENABLED and settings.OPENAI_API_KEY)


def _record(session: Session | None, prompt_type: PromptType, prompt: str, response: str,
            model: str, project_id: str | None = None, user_id: str | None = None) -> None:
    if session is None:
        return
    try:
        record = AIPromptHistory(
            project_id=project_id,
            user_id=user_id,
            prompt_type=prompt_type,
            input_prompt=prompt,
            output_response=response,
            model_name=model,
        )
        session.add(record)
        session.commit()
    except Exception:  # pragma: no cover
        log.warning("ai_history_failed")


def _call_openai(prompt: str, *, json_mode: bool = False) -> str:
    from openai import OpenAI  # local import keeps optional

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    kwargs: dict[str, Any] = {
        "model": settings.OPENAI_MODEL,
        "temperature": 0.2,
        "messages": [{"role": "user", "content": prompt}],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


def _safe_json(raw: str) -> Any:
    """Best-effort JSON parsing — strips markdown fences."""
    cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise


# ---------- Public API ----------

def generate_test_cases(
    session: Session, requirement: str, count: int = 5,
    project_id: str | None = None, user_id: str | None = None,
) -> dict[str, Any]:
    prompt = GENERATE_TEST_CASES.format(requirement=requirement, count=count)
    if not _has_openai():
        items = _fallback_test_cases(requirement, count)
        return {"items": items, "raw": None, "used_fallback": True}
    raw = _call_openai(prompt)
    _record(session, PromptType.TEST_CASE_GENERATION, prompt, raw, settings.OPENAI_MODEL, project_id, user_id)
    try:
        data = _safe_json(raw)
        items = data if isinstance(data, list) else data.get("items") or data.get("test_cases") or []
        return {"items": items, "raw": raw, "used_fallback": False}
    except Exception:
        return {"items": _fallback_test_cases(requirement, count), "raw": raw, "used_fallback": True}


def generate_sql_from_mapping(
    mapping_json: dict[str, Any],
    session: Session | None = None,
    project_id: str | None = None,
    user_id: str | None = None,
) -> str:
    prompt = GENERATE_SQL_FROM_STM.format(mapping_json=json.dumps(mapping_json, indent=2))
    if not _has_openai():
        return render_validation_sql(mapping_json)
    raw = _call_openai(prompt)
    _record(session, PromptType.SQL_GENERATION, prompt, raw, settings.OPENAI_MODEL, project_id, user_id)
    cleaned = re.sub(r"^```(?:sql)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    return cleaned or render_validation_sql(mapping_json)


def analyze_failure(
    session: Session, test_name: str, error_message: str, logs: str | None = None,
) -> dict[str, Any]:
    prompt = ANALYZE_FAILURE.format(test_name=test_name, error_message=error_message, logs=logs or "")
    if not _has_openai():
        return {
            "summary": f"Test '{test_name}' failed.",
            "likely_root_cause": "Unable to determine without AI; review logs and assertion mismatch.",
            "suggested_fix": "Inspect the failing assertion, environment configuration, and recent changes.",
            "is_flaky": False,
            "raw": None,
        }
    raw = _call_openai(prompt, json_mode=True)
    _record(session, PromptType.FAILURE_ANALYSIS, prompt, raw, settings.OPENAI_MODEL)
    try:
        data = _safe_json(raw)
        return {
            "summary": data.get("summary", ""),
            "likely_root_cause": data.get("likely_root_cause", ""),
            "suggested_fix": data.get("suggested_fix", ""),
            "is_flaky": bool(data.get("is_flaky", False)),
            "raw": raw,
        }
    except Exception:
        return {"summary": "AI parse error", "likely_root_cause": raw[:500],
                "suggested_fix": "", "is_flaky": False, "raw": raw}


def generate_no_code_flow(session: Session, scenario: str) -> dict[str, Any]:
    prompt = GENERATE_NO_CODE_FLOW.format(scenario=scenario)
    if not _has_openai():
        flow = _fallback_flow(scenario)
        return {"flow_json": flow, "used_fallback": True}
    raw = _call_openai(prompt, json_mode=True)
    _record(session, PromptType.FLOW_GENERATION, prompt, raw, settings.OPENAI_MODEL)
    try:
        return {"flow_json": _safe_json(raw), "used_fallback": False}
    except Exception:
        return {"flow_json": _fallback_flow(scenario), "used_fallback": True}


def generate_stm_scenarios(
    session: Session | None,
    *,
    scenario: str,
    target_table: str | None = None,
    source_tables: list[str] | None = None,
    count: int = 6,
    project_id: str | None = None,
    user_id: str | None = None,
) -> tuple[list[dict[str, Any]], bool]:
    """Draft STM mappings from a free-form scenario description.

    Returns ``(items, used_fallback)`` so callers can surface the fallback flag.
    Each item is a *partial* STM mapping shaped like the canonical schema
    (`source_table`, `source_column`, `target_table`, `target_column`,
    `join_key`, `transformation_rule`, `validation_type`).
    """
    prompt = GENERATE_STM_SCENARIOS.format(
        scenario=scenario,
        target_table=target_table or "(none)",
        source_tables=", ".join(source_tables or []) or "(none)",
        count=count,
    )
    if not _has_openai():
        return _fallback_stm_scenarios(scenario, target_table, count), True
    raw = _call_openai(prompt, json_mode=True)
    _record(
        session, PromptType.SQL_GENERATION, prompt, raw, settings.OPENAI_MODEL,
        project_id, user_id,
    )
    try:
        data = _safe_json(raw)
        items = data if isinstance(data, list) else data.get("mappings") or data.get("items") or []
        if not isinstance(items, list):
            items = []
        cleaned: list[dict[str, Any]] = []
        for item in items[:count]:
            if isinstance(item, dict):
                cleaned.append(item)
        if not cleaned:
            return _fallback_stm_scenarios(scenario, target_table, count), True
        return cleaned, False
    except Exception:
        return _fallback_stm_scenarios(scenario, target_table, count), True


def suggest_edge_cases(session: Session, requirement: str) -> dict[str, Any]:
    prompt = SUGGEST_EDGE_CASES.format(requirement=requirement)
    if not _has_openai():
        return {"edge_cases": _fallback_edge_cases(requirement), "used_fallback": True}
    raw = _call_openai(prompt)
    _record(session, PromptType.TEST_CASE_GENERATION, prompt, raw, settings.OPENAI_MODEL)
    try:
        data = _safe_json(raw)
        return {"edge_cases": data if isinstance(data, list) else data.get("edge_cases", []),
                "used_fallback": False}
    except Exception:
        return {"edge_cases": _fallback_edge_cases(requirement), "used_fallback": True}


# ---------- Deterministic fallbacks ----------

def _fallback_test_cases(requirement: str, count: int) -> list[dict[str, Any]]:
    base_title = requirement[:80]
    templates = [
        ("Happy path", "MEDIUM"),
        ("Invalid input", "HIGH"),
        ("Boundary value", "MEDIUM"),
        ("Empty/null payload", "MEDIUM"),
        ("Authorization denied", "HIGH"),
        ("Network failure", "HIGH"),
        ("Concurrency / race", "CRITICAL"),
    ]
    items = []
    for _idx, (suffix, priority) in enumerate(templates[:count], start=1):
        items.append({
            "title": f"{base_title} - {suffix}",
            "description": f"{suffix} scenario derived from requirement.",
            "preconditions": "User has access to the application.",
            "steps": [
                {"step_order": 1, "action": f"Setup {suffix.lower()} state", "expected_result": "State ready"},
                {"step_order": 2, "action": "Trigger feature under test", "expected_result": "Feature responds"},
                {"step_order": 3, "action": "Verify outcome", "expected_result": "Outcome matches expectation"},
            ],
            "expected_result": "System behaves correctly per the requirement.",
            "priority": priority,
            "test_type": "MANUAL",
        })
    return items


def _fallback_flow(scenario: str) -> dict[str, Any]:
    return {
        "flow_name": scenario[:60] or "auto_flow",
        "runtime": "PLAYWRIGHT",
        "steps": [
            {"id": "step_1", "type": "open_page", "config": {"url": "{{base_url}}"}},
            {"id": "step_2", "type": "assert_visible", "config": {"selector": "body"}},
        ],
    }


def _fallback_stm_scenarios(
    scenario: str, target_table: str | None, count: int,
) -> list[dict[str, Any]]:
    """Deterministic STM scenarios — used when OpenAI is unavailable."""
    target = target_table or "target_table"
    keyword = (scenario.split()[0] if scenario else "entity").lower()
    blueprints = [
        {
            "source_table": f"src_{keyword}",
            "source_column": "*",
            "target_table": target,
            "target_column": "*",
            "join_key": None,
            "transformation_rule": "Row counts must match between source and target.",
            "validation_type": "ROW_COUNT",
        },
        {
            "source_table": f"src_{keyword}",
            "source_column": "id",
            "target_table": target,
            "target_column": "id",
            "join_key": "id",
            "transformation_rule": "Primary key must not be null in target.",
            "validation_type": "NULL_CHECK",
        },
        {
            "source_table": f"src_{keyword}",
            "source_column": "id",
            "target_table": target,
            "target_column": "id",
            "join_key": "id",
            "transformation_rule": "id must be unique in target.",
            "validation_type": "DUPLICATE_CHECK",
        },
        {
            "source_table": f"src_{keyword}",
            "source_column": "amount",
            "target_table": target,
            "target_column": "amount_usd",
            "join_key": "id",
            "transformation_rule": "amount_usd = amount * fx_rate (rounded to 2dp).",
            "validation_type": "TRANSFORMATION_CHECK",
        },
        {
            "source_table": "ref_country",
            "source_column": "country_code",
            "target_table": target,
            "target_column": "country_code",
            "join_key": "country_code",
            "transformation_rule": "Every target country_code must exist in ref_country.",
            "validation_type": "REFERENCE_CHECK",
        },
        {
            "source_table": f"src_{keyword}",
            "source_column": "created_at",
            "target_table": target,
            "target_column": "created_at",
            "join_key": "id",
            "transformation_rule": "created_at must be preserved (no truncation).",
            "validation_type": "TRANSFORMATION_CHECK",
        },
    ]
    return blueprints[: max(1, min(count, len(blueprints)))]


def _fallback_edge_cases(requirement: str) -> list[str]:
    return [
        "Empty input",
        "Maximum length input",
        "Special characters / unicode",
        "Concurrent requests",
        "Expired or invalid token",
        "Network timeout / slow response",
        "Permission boundary (other user data)",
        "Idempotency on retry",
    ]
