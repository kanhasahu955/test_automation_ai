"""Unit tests for the global app-settings service.

Covers the behaviour the UI relies on:

* the API key is *never* returned plaintext, only ``api_key_set``;
* sending ``api_key=None`` keeps the existing key;
* sending an empty string clears it;
* notification preferences round-trip cleanly through JSON.
"""
from __future__ import annotations

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.modules.app_settings import service
from app.modules.app_settings.schemas import (
    LlmSettingsUpdate,
    NotificationChannelConfig,
    NotificationSettings,
)


def _make_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _llm_payload(**overrides: object) -> LlmSettingsUpdate:
    base: dict[str, object] = {
        "enabled": True,
        "provider": "OPENAI",
        "model": "gpt-4o-mini",
        "base_url": "https://api.openai.com/v1",
        "temperature": 0.2,
        "max_tokens": 1024,
        "timeout_seconds": 30,
        "api_key": "sk-secret",
    }
    base.update(overrides)
    return LlmSettingsUpdate.model_validate(base)


# ---------- LLM ---------------------------------------------------------------


def test_llm_initial_get_returns_defaults() -> None:
    with _make_session() as session:
        cfg = service.get_llm(session)
    assert cfg.provider == "OPENAI"
    assert cfg.api_key_set is False


def test_llm_update_stores_key_and_round_trips() -> None:
    with _make_session() as session:
        cfg = service.update_llm(session, _llm_payload(), user_id=None)
        assert cfg.api_key_set is True
        # Plain value is recoverable through the helper, but never via the public DTO.
        assert service.get_llm_api_key(session) == "sk-secret"
        assert "api_key" not in cfg.model_dump()


def test_llm_update_keeps_existing_key_when_omitted() -> None:
    with _make_session() as session:
        service.update_llm(session, _llm_payload(), user_id=None)

        # Send an update without an api_key — the previous one must stay.
        next_payload = _llm_payload(api_key=None, temperature=0.7)
        cfg = service.update_llm(session, next_payload, user_id=None)

        assert cfg.api_key_set is True
        assert cfg.temperature == 0.7
        assert service.get_llm_api_key(session) == "sk-secret"


def test_llm_update_with_empty_string_clears_key() -> None:
    with _make_session() as session:
        service.update_llm(session, _llm_payload(), user_id=None)

        cfg = service.update_llm(session, _llm_payload(api_key=""), user_id=None)

        assert cfg.api_key_set is False
        assert service.get_llm_api_key(session) is None


# ---------- Notifications -----------------------------------------------------


def test_notifications_round_trip() -> None:
    payload = NotificationSettings(
        email=NotificationChannelConfig(
            enabled=True,
            recipients=["qa@example.com", "  lead@example.com  "],
        ),
        slack=NotificationChannelConfig(
            enabled=True,
            webhook_url="https://hooks.slack.com/services/abc",
            recipients=["#qa"],
        ),
    )

    with _make_session() as session:
        saved = service.update_notifications(session, payload, user_id=None)
        loaded = service.get_notifications(session)

    assert saved.email.enabled is True
    # Whitespace stripping on recipients
    assert saved.email.recipients == ["qa@example.com", "lead@example.com"]
    assert saved.slack.webhook_url == "https://hooks.slack.com/services/abc"
    assert loaded.model_dump() == saved.model_dump()


def test_notifications_default_when_unset() -> None:
    with _make_session() as session:
        cfg = service.get_notifications(session)
    assert cfg.events.run_failed is True
    assert cfg.email.enabled is False
