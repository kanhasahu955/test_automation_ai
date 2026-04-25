"""DTOs for app-wide preferences."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

LlmProvider = Literal["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "OLLAMA", "DISABLED"]
NotificationChannel = Literal["EMAIL", "SLACK", "TEAMS", "WEBHOOK"]


class LlmSettings(BaseModel):
    """Global LLM connection + sampling defaults.

    The API key is never returned — reads come back with ``api_key_set: bool``
    so the UI can show a "key is stored" indicator without leaking the value.
    """

    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    provider: LlmProvider = "OPENAI"
    model: str = Field(default="gpt-4o-mini", max_length=120)
    base_url: str = Field(default="https://api.openai.com/v1", max_length=500)
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=64, le=32000)
    timeout_seconds: int = Field(default=30, ge=5, le=300)


class LlmSettingsUpdate(LlmSettings):
    """Same shape as :class:`LlmSettings` plus an optional rotated API key."""

    api_key: str | None = Field(default=None, min_length=0, max_length=500)
    """``None`` keeps the existing key; an empty string clears it."""


class LlmSettingsRead(LlmSettings):
    """LLM settings sent to the UI — never includes the raw API key."""

    api_key_set: bool = False


class LlmTestRequest(BaseModel):
    """One-shot LLM smoke-test using the *currently saved* settings."""

    prompt: str = Field(default="Reply with the single word 'pong'.", min_length=1, max_length=500)


class LlmTestResult(BaseModel):
    ok: bool
    message: str
    sample: str | None = None


class NotificationEventToggles(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_failed: bool = True
    regression_detected: bool = True
    profiling_anomaly: bool = True
    schedule_failed: bool = True
    quality_drop: bool = True


class NotificationChannelConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = False
    recipients: list[str] = Field(default_factory=list)
    webhook_url: str | None = Field(default=None, max_length=500)

    @field_validator("recipients")
    @classmethod
    def _strip_recipients(cls, value: list[str]) -> list[str]:
        return [r.strip() for r in value if r and r.strip()]


class NotificationSettings(BaseModel):
    """How and when to notify."""

    model_config = ConfigDict(extra="forbid")

    events: NotificationEventToggles = Field(default_factory=NotificationEventToggles)
    email: NotificationChannelConfig = Field(default_factory=NotificationChannelConfig)
    slack: NotificationChannelConfig = Field(default_factory=NotificationChannelConfig)
    teams: NotificationChannelConfig = Field(default_factory=NotificationChannelConfig)
    webhook: NotificationChannelConfig = Field(default_factory=NotificationChannelConfig)
    digest_email: EmailStr | None = None


# Reads/writes share a shape for notifications — no secrets to mask.
NotificationSettingsRead = NotificationSettings
NotificationSettingsUpdate = NotificationSettings
