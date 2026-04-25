"""App settings service.

Persists structured preferences (LLM, notifications) in a single key/value
``app_settings`` table. Reads return validated DTOs; writes upsert with the
calling user stamped on ``updated_by``.

Secrets (the LLM API key) are stored encrypted via :mod:`app.core.security`.
The plaintext is **never** returned over the API; consumers see ``api_key_set``
instead.
"""
from __future__ import annotations

from typing import Any

from sqlmodel import Session, select

from app.core.security import decrypt_secret, encrypt_secret
from app.modules.app_settings.models import AppSetting
from app.modules.app_settings.schemas import (
    LlmSettings,
    LlmSettingsRead,
    LlmSettingsUpdate,
    LlmTestRequest,
    LlmTestResult,
    NotificationSettings,
)

LLM_KEY = "llm"
NOTIFICATIONS_KEY = "notifications"
_ENCRYPTED_KEY_FIELD = "_encrypted_api_key"


# ---------- Generic helpers ---------------------------------------------------

def _get_or_create(session: Session, key: str) -> AppSetting:
    record = session.exec(select(AppSetting).where(AppSetting.key == key)).first()
    if record is None:
        record = AppSetting(key=key, value={})
        session.add(record)
        session.commit()
        session.refresh(record)
    return record


def _save(
    session: Session,
    key: str,
    value: dict[str, Any],
    user_id: str | None,
) -> AppSetting:
    record = _get_or_create(session, key)
    record.value = value
    record.updated_by = user_id
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


# ---------- LLM ---------------------------------------------------------------

def get_llm(session: Session) -> LlmSettingsRead:
    record = _get_or_create(session, LLM_KEY)
    raw = dict(record.value or {})
    has_key = bool(raw.pop(_ENCRYPTED_KEY_FIELD, None))
    base = LlmSettings.model_validate(raw) if raw else LlmSettings()
    return LlmSettingsRead(**base.model_dump(), api_key_set=has_key)


def update_llm(
    session: Session, payload: LlmSettingsUpdate, user_id: str | None
) -> LlmSettingsRead:
    record = _get_or_create(session, LLM_KEY)
    existing = dict(record.value or {})
    encrypted = existing.get(_ENCRYPTED_KEY_FIELD)

    base = LlmSettings(**payload.model_dump(exclude={"api_key"}))
    new_value: dict[str, Any] = base.model_dump()

    if payload.api_key is None:
        if encrypted:
            new_value[_ENCRYPTED_KEY_FIELD] = encrypted
    elif payload.api_key.strip() == "":
        # explicit clear
        pass
    else:
        new_value[_ENCRYPTED_KEY_FIELD] = encrypt_secret(payload.api_key.strip())

    _save(session, LLM_KEY, new_value, user_id)
    return get_llm(session)


def get_llm_api_key(session: Session) -> str | None:
    record = _get_or_create(session, LLM_KEY)
    encrypted = (record.value or {}).get(_ENCRYPTED_KEY_FIELD)
    if not encrypted:
        return None
    try:
        return decrypt_secret(encrypted)
    except Exception:
        return None


def test_llm(session: Session, payload: LlmTestRequest) -> LlmTestResult:
    """Round-trip the configured LLM with a tiny prompt; never raises."""
    cfg = get_llm(session)
    if not cfg.enabled or cfg.provider == "DISABLED":
        return LlmTestResult(ok=False, message="LLM is disabled in settings.")
    api_key = get_llm_api_key(session)
    if not api_key and cfg.provider not in ("OLLAMA",):
        return LlmTestResult(ok=False, message="No API key stored for the selected provider.")
    try:
        # Lazy import: keeps this module importable even if openai is absent at runtime.
        from openai import OpenAI

        client = OpenAI(api_key=api_key or "ollama", base_url=cfg.base_url)
        response = client.chat.completions.create(
            model=cfg.model,
            temperature=cfg.temperature,
            max_tokens=min(cfg.max_tokens, 64),
            timeout=cfg.timeout_seconds,
            messages=[{"role": "user", "content": payload.prompt}],
        )
        sample = (response.choices[0].message.content or "").strip()
        return LlmTestResult(ok=True, message="LLM responded successfully.", sample=sample[:200])
    except Exception as exc:  # pragma: no cover - depends on remote
        return LlmTestResult(ok=False, message=f"LLM call failed: {exc}")


# ---------- Notifications -----------------------------------------------------

def get_notifications(session: Session) -> NotificationSettings:
    record = _get_or_create(session, NOTIFICATIONS_KEY)
    raw = record.value or {}
    if not raw:
        return NotificationSettings()
    return NotificationSettings.model_validate(raw)


def update_notifications(
    session: Session,
    payload: NotificationSettings,
    user_id: str | None,
) -> NotificationSettings:
    _save(session, NOTIFICATIONS_KEY, payload.model_dump(), user_id)
    return get_notifications(session)
