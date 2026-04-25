"""AI generation service.

Resolves the LLM configuration in this order of precedence:

1. **DB-backed app settings** (`/api/v1/settings/llm`) — what the in-app
   "Settings → LLM" screen writes. These are the source of truth for
   running deployments because admins can rotate the key without redeploys.
2. **Process environment** (``OPENAI_API_KEY`` / ``OPENAI_MODEL`` /
   ``OPENAI_BASE_URL`` / ``AI_ENABLED``) — convenient for dev and CI.

If neither yields a usable configuration, every public function falls back
to deterministic templates and sets ``used_fallback: True``.

When the LLM is configured but the call fails (bad key, model, network),
we raise :class:`app.core.errors.AppError` with a helpful message — the
frontend already knows how to render that via ``getApiErrorMessage``.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from sqlmodel import Session

from app.core.config import settings
from app.core.errors import AppError
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


# ---------- LLM configuration resolution -------------------------------------


@dataclass(frozen=True)
class _LlmConfig:
    """Effective LLM configuration after merging DB + env."""

    api_key: str
    model: str
    base_url: str | None
    temperature: float
    max_tokens: int
    timeout_seconds: int
    provider: str
    source: str  # "db" or "env" — for logs / debug surfacing


def _resolve_config(session: Session | None) -> _LlmConfig | None:
    """Pick the best available LLM config; ``None`` means "no LLM, use fallbacks".

    DB-backed settings take priority because they're rotatable at runtime.
    The env path is the dev-friendly fallback used when no admin has
    configured Settings → LLM yet.
    """
    db_cfg = _try_db_config(session)
    if db_cfg is not None:
        return db_cfg
    return _try_env_config()


def _try_db_config(session: Session | None) -> _LlmConfig | None:
    if session is None:
        return None
    try:
        # Local imports avoid a circular module dependency at import time.
        from app.modules.app_settings.service import get_llm, get_llm_api_key

        cfg = get_llm(session)
        if not cfg.enabled or cfg.provider == "DISABLED":
            return None
        api_key = get_llm_api_key(session) or ""
        # Ollama doesn't need a real key; everyone else does.
        if not api_key and cfg.provider != "OLLAMA":
            return None
        return _LlmConfig(
            api_key=api_key or "ollama",
            model=cfg.model,
            base_url=cfg.base_url or None,
            temperature=cfg.temperature,
            max_tokens=cfg.max_tokens,
            timeout_seconds=cfg.timeout_seconds,
            provider=cfg.provider,
            source="db",
        )
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("ai.db_config_failed", error=str(exc))
        return None


def _try_env_config() -> _LlmConfig | None:
    if not settings.AI_ENABLED:
        return None
    api_key = (settings.OPENAI_API_KEY or "").strip()
    if not api_key or api_key.startswith("replace-me"):
        return None
    return _LlmConfig(
        api_key=api_key,
        model=settings.OPENAI_MODEL,
        base_url=(settings.OPENAI_BASE_URL or "").strip() or None,
        temperature=0.2,
        max_tokens=1024,
        timeout_seconds=60,
        provider="OPENAI",
        source="env",
    )


def _has_llm(session: Session | None) -> bool:
    return _resolve_config(session) is not None


def get_status(session: Session | None) -> dict[str, Any]:
    """Public summary of the active LLM config — used by the AI Studio banner.

    Never includes the API key. ``reason`` explains *why* it's disabled when
    that's the case, so the UI can guide the admin to fix it.
    """
    cfg = _resolve_config(session)
    if cfg is not None:
        return {
            "enabled": True,
            "provider": cfg.provider,
            "model": cfg.model,
            "source": cfg.source,
            "reason": None,
        }
    # Disabled — figure out why so the UI banner is actionable.
    if not settings.AI_ENABLED:
        reason = "AI is disabled (AI_ENABLED=false in backend env)."
    else:
        reason = (
            "No LLM is configured. Open Settings → LLM to set a provider + API key, "
            "or set OPENAI_API_KEY in the backend environment."
        )
    return {
        "enabled": False,
        "provider": None,
        "model": None,
        "source": None,
        "reason": reason,
    }


def _record(
    session: Session | None,
    prompt_type: PromptType,
    prompt: str,
    response: str,
    model: str,
    project_id: str | None = None,
    user_id: str | None = None,
) -> None:
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


def _call_llm(cfg: _LlmConfig, prompt: str, *, json_mode: bool = False) -> str:
    """Call the configured LLM. Raises :class:`AppError` on failure."""
    try:
        # Lazy import keeps the dependency optional at module-load time.
        from openai import OpenAI

        client = OpenAI(api_key=cfg.api_key, base_url=cfg.base_url)
        kwargs: dict[str, Any] = {
            "model": cfg.model,
            "temperature": cfg.temperature,
            "max_tokens": cfg.max_tokens,
            "timeout": cfg.timeout_seconds,
            "messages": [{"role": "user", "content": prompt}],
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        response = client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""
    except AppError:
        raise
    except Exception as exc:
        # Map common provider errors to user-friendly messages. We deliberately
        # avoid leaking the API key or other internals.
        message = _humanize_llm_error(exc, cfg)
        log.error(
            "ai.llm_call_failed",
            error=str(exc),
            error_type=exc.__class__.__name__,
            model=cfg.model,
            provider=cfg.provider,
            source=cfg.source,
        )
        raise AppError(
            message,
            code="ai_provider_error",
            status_code=502,
            extra={"provider": cfg.provider, "model": cfg.model, "source": cfg.source},
        ) from exc


def _call_llm_stream(cfg: _LlmConfig, prompt: str):
    """Yield text deltas from the LLM as they arrive.

    Generator: each ``yield`` returns a string chunk (zero or more tokens).
    Use only for the prose-friendly endpoints — JSON-mode generations do
    *not* stream cleanly because the JSON is only valid after the last
    token, so callers should still buffer + parse for those.

    Errors are wrapped as :class:`AppError` exactly like ``_call_llm``.
    """
    try:
        from openai import OpenAI

        client = OpenAI(api_key=cfg.api_key, base_url=cfg.base_url)
        kwargs: dict[str, Any] = {
            "model": cfg.model,
            "temperature": cfg.temperature,
            "max_tokens": cfg.max_tokens,
            "timeout": cfg.timeout_seconds,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
        }
        with client.chat.completions.create(**kwargs) as stream:
            for chunk in stream:
                # OpenAI SDK 1.x returns ChatCompletionChunk objects.
                try:
                    delta = chunk.choices[0].delta.content
                except (AttributeError, IndexError):
                    delta = None
                if delta:
                    yield delta
    except AppError:
        raise
    except Exception as exc:
        message = _humanize_llm_error(exc, cfg)
        log.error(
            "ai.llm_stream_failed",
            error=str(exc),
            error_type=exc.__class__.__name__,
            model=cfg.model,
            provider=cfg.provider,
            source=cfg.source,
        )
        raise AppError(
            message,
            code="ai_provider_error",
            status_code=502,
            extra={"provider": cfg.provider, "model": cfg.model, "source": cfg.source},
        ) from exc


def _humanize_llm_error(exc: Exception, cfg: _LlmConfig) -> str:
    """Best-effort translation of provider exceptions into actionable messages."""
    name = exc.__class__.__name__
    raw = str(exc)
    lowered = raw.lower()
    if "authentication" in lowered or "invalid_api_key" in lowered or name == "AuthenticationError":
        return (
            f"AI provider rejected the API key (configured via {cfg.source}). "
            "Open Settings → LLM and rotate the key, or update OPENAI_API_KEY."
        )
    if "rate limit" in lowered or name == "RateLimitError":
        return "AI provider rate limit reached. Please wait a moment and retry."
    if "timeout" in lowered or name in {"APITimeoutError", "Timeout"}:
        return f"AI provider timed out after {cfg.timeout_seconds}s. Try a shorter prompt or increase the timeout in Settings → LLM."
    if "not found" in lowered and "model" in lowered:
        return f"Model '{cfg.model}' is not available for this account. Pick a different model in Settings → LLM."
    if "connection" in lowered or name in {"APIConnectionError", "ConnectionError"}:
        return "Could not reach the AI provider. Check the base URL / network and try again."
    return f"AI call failed ({name}). See server logs for details."


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


# ---------- Public API -------------------------------------------------------

def generate_test_cases(
    session: Session, requirement: str, count: int = 5,
    project_id: str | None = None, user_id: str | None = None,
) -> dict[str, Any]:
    prompt = GENERATE_TEST_CASES.format(requirement=requirement, count=count)
    cfg = _resolve_config(session)
    if cfg is None:
        items = _fallback_test_cases(requirement, count)
        return {"items": items, "raw": None, "used_fallback": True}
    raw = _call_llm(cfg, prompt)
    _record(session, PromptType.TEST_CASE_GENERATION, prompt, raw, cfg.model, project_id, user_id)
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
    cfg = _resolve_config(session)
    if cfg is None:
        return render_validation_sql(mapping_json)
    raw = _call_llm(cfg, prompt)
    _record(session, PromptType.SQL_GENERATION, prompt, raw, cfg.model, project_id, user_id)
    cleaned = re.sub(r"^```(?:sql)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    return cleaned or render_validation_sql(mapping_json)


def analyze_failure(
    session: Session, test_name: str, error_message: str, logs: str | None = None,
) -> dict[str, Any]:
    prompt = ANALYZE_FAILURE.format(test_name=test_name, error_message=error_message, logs=logs or "")
    cfg = _resolve_config(session)
    if cfg is None:
        return {
            "summary": f"Test '{test_name}' failed.",
            "likely_root_cause": "Unable to determine without AI; review logs and assertion mismatch.",
            "suggested_fix": "Inspect the failing assertion, environment configuration, and recent changes.",
            "is_flaky": False,
            "raw": None,
        }
    raw = _call_llm(cfg, prompt, json_mode=True)
    _record(session, PromptType.FAILURE_ANALYSIS, prompt, raw, cfg.model)
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
    cfg = _resolve_config(session)
    if cfg is None:
        flow = _fallback_flow(scenario)
        return {"flow_json": flow, "used_fallback": True}
    raw = _call_llm(cfg, prompt, json_mode=True)
    _record(session, PromptType.FLOW_GENERATION, prompt, raw, cfg.model)
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
    cfg = _resolve_config(session)
    if cfg is None:
        return _fallback_stm_scenarios(scenario, target_table, count), True
    raw = _call_llm(cfg, prompt, json_mode=True)
    _record(
        session, PromptType.SQL_GENERATION, prompt, raw, cfg.model,
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
    cfg = _resolve_config(session)
    if cfg is None:
        return {"edge_cases": _fallback_edge_cases(requirement), "used_fallback": True}
    raw = _call_llm(cfg, prompt)
    _record(session, PromptType.TEST_CASE_GENERATION, prompt, raw, cfg.model)
    try:
        data = _safe_json(raw)
        return {"edge_cases": data if isinstance(data, list) else data.get("edge_cases", []),
                "used_fallback": False}
    except Exception:
        return {"edge_cases": _fallback_edge_cases(requirement), "used_fallback": True}


# ---------- Streaming generators ---------------------------------------------
#
# Streaming is implemented as **synchronous generators**. The realtime route
# wraps the generator with ``starlette.concurrency.run_in_threadpool`` /
# ``iterate_in_threadpool`` so we don't block the event loop. We emit three
# event kinds the UI cares about:
#
#   * ``meta``     — config snapshot (provider/model/source) sent once.
#   * ``token``    — raw text delta from the LLM.
#   * ``parsed``   — once streaming completes, the *parsed* structured result
#                    (so the UI can replace its in-progress preview with the
#                    typed value used by Redux state).
#   * ``done``     — terminal signal so the SSE consumer can close cleanly.
#   * ``error``    — included as the last event when something blew up.


def stream_test_cases(
    session: Session, requirement: str, count: int = 5,
    project_id: str | None = None, user_id: str | None = None,
):
    """Generator yielding ``(event_type, payload)`` tuples for SSE relay."""
    cfg = _resolve_config(session)
    if cfg is None:
        items = _fallback_test_cases(requirement, count)
        yield "meta", {"provider": None, "model": None, "source": None, "used_fallback": True}
        yield "parsed", {"items": items, "used_fallback": True}
        yield "done", {}
        return

    yield "meta", {
        "provider": cfg.provider,
        "model": cfg.model,
        "source": cfg.source,
        "used_fallback": False,
    }

    prompt = GENERATE_TEST_CASES.format(requirement=requirement, count=count)
    buffer: list[str] = []
    try:
        for delta in _call_llm_stream(cfg, prompt):
            buffer.append(delta)
            yield "token", {"delta": delta}
        raw = "".join(buffer)
        _record(
            session, PromptType.TEST_CASE_GENERATION, prompt, raw, cfg.model,
            project_id, user_id,
        )
        try:
            data = _safe_json(raw)
            items = data if isinstance(data, list) else (
                data.get("items") or data.get("test_cases") or []
            )
            yield "parsed", {"items": items, "used_fallback": False, "raw": raw}
        except Exception:
            yield "parsed", {
                "items": _fallback_test_cases(requirement, count),
                "used_fallback": True,
                "raw": raw,
            }
        yield "done", {}
    except AppError as exc:
        yield "error", {"message": str(exc), "code": exc.code}
        yield "done", {}


def stream_edge_cases(session: Session, requirement: str):
    """Generator yielding ``(event_type, payload)`` tuples for SSE relay."""
    cfg = _resolve_config(session)
    if cfg is None:
        yield "meta", {"provider": None, "model": None, "source": None, "used_fallback": True}
        yield "parsed", {"edge_cases": _fallback_edge_cases(requirement), "used_fallback": True}
        yield "done", {}
        return

    yield "meta", {
        "provider": cfg.provider,
        "model": cfg.model,
        "source": cfg.source,
        "used_fallback": False,
    }

    prompt = SUGGEST_EDGE_CASES.format(requirement=requirement)
    buffer: list[str] = []
    try:
        for delta in _call_llm_stream(cfg, prompt):
            buffer.append(delta)
            yield "token", {"delta": delta}
        raw = "".join(buffer)
        _record(session, PromptType.TEST_CASE_GENERATION, prompt, raw, cfg.model)
        try:
            data = _safe_json(raw)
            edge_cases = data if isinstance(data, list) else data.get("edge_cases", [])
            yield "parsed", {"edge_cases": edge_cases, "used_fallback": False, "raw": raw}
        except Exception:
            yield "parsed", {
                "edge_cases": _fallback_edge_cases(requirement),
                "used_fallback": True,
                "raw": raw,
            }
        yield "done", {}
    except AppError as exc:
        yield "error", {"message": str(exc), "code": exc.code}
        yield "done", {}


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
