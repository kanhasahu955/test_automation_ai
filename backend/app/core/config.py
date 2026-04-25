"""Centralized application configuration.

Layered configuration loading order (highest priority first):

  1. Process environment variables.
  2. ``backend/.env`` file.
  3. ``config/{APP_ENV}.yaml`` overlay.
  4. ``config/base.yaml`` defaults.
  5. Field defaults declared on :class:`Settings`.

The YAML layer is wired in via the official Pydantic-Settings
``settings_customise_sources`` hook so env vars **always** win, no matter what
``base.yaml`` says.

Use ``get_settings()`` (cached) anywhere you need configuration; this is the
single source of truth for the application.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Any

from pydantic import Field, computed_field, field_validator
from pydantic.fields import FieldInfo
from pydantic_settings import (
    BaseSettings,
    NoDecode,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)

from app.core.config_loader import load_yaml_settings


class _YamlSettingsSource(PydanticBaseSettingsSource):
    """Pydantic-Settings source that materialises the YAML layer.

    Implementing both ``__call__`` and ``get_field_value`` keeps us compatible
    with the v2 source pipeline regardless of whether Pydantic-Settings calls us
    field-by-field or in bulk.
    """

    def __init__(self, settings_cls: type[BaseSettings]) -> None:
        super().__init__(settings_cls)
        self._yaml: dict[str, Any] = load_yaml_settings()

    def get_field_value(
        self,
        field: FieldInfo,
        field_name: str,
    ) -> tuple[Any, str, bool]:
        if field_name in self._yaml:
            return self._yaml[field_name], field_name, False
        return None, field_name, False

    def __call__(self) -> dict[str, Any]:
        return dict(self._yaml)


class Settings(BaseSettings):
    """Strongly-typed application settings.

    Values come from (highest → lowest priority): env → ``.env`` → YAML overlay
    → ``base.yaml`` → field defaults. Compose readable URLs via the
    :pyattr:`database_url` / :pyattr:`is_production` properties.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App ----
    APP_NAME: str = "QualityForge AI"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    API_PREFIX: str = "/api/v1"
    # NoDecode keeps pydantic-settings from JSON-decoding the env value so the
    # ``_split_cors`` validator can accept the simple comma-separated form
    # (e.g. ``CORS_ORIGINS=http://a,http://b``) used in ``.env``.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    # ---- Security ----
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRES_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRES_DAYS: int = 14
    PASSWORD_PEPPER: str = "change-me-pepper"
    ENCRYPTION_KEY: str = "ZmFrZS1lbmNyeXB0aW9uLWtleS1jaGFuZ2UtbWUtMzItYnl0ZXM="

    # ---- DB ----
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "root"
    DB_NAME: str = "qualityforge"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_CONNECT_TIMEOUT_S: int = 5

    # ---- Redis / Celery ----
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ---- External operational dashboards (UI links) ----
    # These are *external* links — the API only checks whether each is reachable.
    # Override per-environment via .env or YAML overlay.
    FLOWER_URL: str = "http://localhost:5555"
    REDIS_COMMANDER_URL: str = "http://localhost:8081"
    AIRFLOW_URL: str = "http://localhost:8088"

    # ---- Storage ----
    ARTIFACTS_DIR: str = "/var/qf/artifacts"
    UPLOADS_DIR: str = "/var/qf/uploads"

    # ---- AI ----
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"
    AI_ENABLED: bool = True

    # ---- Bootstrap ----
    BOOTSTRAP_ADMIN_EMAIL: str = "admin@qualityforge.ai"
    BOOTSTRAP_ADMIN_PASSWORD: str = "Admin@12345"
    BOOTSTRAP_ADMIN_NAME: str = "Platform Admin"

    # ---- Worker / data tuning knobs ----
    METADATA_MAX_TABLES: int = 100
    PROFILING_MAX_TABLES: int = 50
    PROFILING_SAMPLE_SIZE: int = 1000
    REPORT_RECENT_RUNS_LIMIT: int = 50
    STM_VALIDATION_FETCH: int = 50

    # ---------------- Validators ----------------
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    # ---------------- Computed ----------------
    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_development(self) -> bool:
        return self.APP_ENV.lower() == "development"

    # ---------------- Sources pipeline ----------------
    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Order = priority (first wins). YAML is below .env so env vars override it.
        return (
            init_settings,
            env_settings,
            dotenv_settings,
            file_secret_settings,
            _YamlSettingsSource(settings_cls),
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide :class:`Settings` instance (cached).

    Call ``get_settings.cache_clear()`` in tests to force a reload.
    """
    return Settings()


def _build_settings() -> Settings:
    """Build a fresh, uncached :class:`Settings` (testing helper)."""
    return Settings()


# Convenience singleton — prefer ``get_settings()`` in new code so tests can swap it.
settings = get_settings()


__all__ = ["Settings", "get_settings", "settings"]
