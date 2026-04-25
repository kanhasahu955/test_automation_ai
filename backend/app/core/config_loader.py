"""YAML configuration loader.

Loads ``config/base.yaml`` and ``config/{env}.yaml`` (if present), deep-merges them,
and flattens the result into the FLAT keys understood by :class:`app.core.config.Settings`
(``APP_NAME``, ``DB_HOST``, ``CELERY_BROKER_URL``, …).

Keys are mapped from nested YAML to flat env-style keys via :data:`KEY_MAP`.
Anything not mapped is silently ignored — the YAML files are explicitly the
**non-secret** defaults; ``.env`` and process env vars always win.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

CONFIG_DIR_ENV = "QF_CONFIG_DIR"
APP_ENV_VAR = "APP_ENV"
DEFAULT_ENV = "development"


# Maps nested YAML paths -> flat Settings field name. Add new entries here when
# you introduce a new setting that should be configurable from YAML.
KEY_MAP: dict[tuple[str, ...], str] = {
    ("app", "name"): "APP_NAME",
    ("app", "env"): "APP_ENV",
    ("app", "debug"): "APP_DEBUG",
    ("app", "host"): "APP_HOST",
    ("app", "port"): "APP_PORT",
    ("app", "api_prefix"): "API_PREFIX",
    ("app", "cors_origins"): "CORS_ORIGINS",

    ("security", "jwt_algorithm"): "JWT_ALGORITHM",
    ("security", "access_token_expires_minutes"): "ACCESS_TOKEN_EXPIRES_MINUTES",
    ("security", "refresh_token_expires_days"): "REFRESH_TOKEN_EXPIRES_DAYS",

    ("database", "pool_size"): "DB_POOL_SIZE",
    ("database", "max_overflow"): "DB_MAX_OVERFLOW",
    ("database", "connect_timeout_s"): "DB_CONNECT_TIMEOUT_S",

    ("redis", "url"): "REDIS_URL",

    ("celery", "broker_url"): "CELERY_BROKER_URL",
    ("celery", "result_backend"): "CELERY_RESULT_BACKEND",

    ("storage", "artifacts_dir"): "ARTIFACTS_DIR",
    ("storage", "uploads_dir"): "UPLOADS_DIR",

    ("ai", "enabled"): "AI_ENABLED",
    ("ai", "model"): "OPENAI_MODEL",
    ("ai", "base_url"): "OPENAI_BASE_URL",

    ("worker", "metadata_max_tables"): "METADATA_MAX_TABLES",
    ("worker", "profiling_max_tables"): "PROFILING_MAX_TABLES",
    ("worker", "profiling_sample_size"): "PROFILING_SAMPLE_SIZE",
    ("worker", "report_recent_runs_limit"): "REPORT_RECENT_RUNS_LIMIT",
    ("worker", "stm_validation_fetch"): "STM_VALIDATION_FETCH",

    ("bootstrap", "admin_email"): "BOOTSTRAP_ADMIN_EMAIL",
    ("bootstrap", "admin_name"): "BOOTSTRAP_ADMIN_NAME",
}


def _config_dir() -> Path:
    """Return the directory containing YAML config files.

    Resolution order:
      1. ``QF_CONFIG_DIR`` env var (absolute path).
      2. ``backend/config/`` (relative to this file).
    """
    if env_dir := os.getenv(CONFIG_DIR_ENV):
        return Path(env_dir).expanduser().resolve()
    return Path(__file__).resolve().parents[2] / "config"


def _read_yaml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        raise ValueError(f"YAML root must be a mapping in {path}")
    return data


def _deep_merge(base: dict[str, Any], over: dict[str, Any]) -> dict[str, Any]:
    """Recursive dict merge — ``over`` wins on conflicts; lists are replaced wholesale."""
    out: dict[str, Any] = dict(base)
    for key, value in over.items():
        if key in out and isinstance(out[key], dict) and isinstance(value, dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def _flatten(yaml_dict: dict[str, Any]) -> dict[str, Any]:
    """Translate nested YAML to a flat dict keyed by Settings field names."""
    flat: dict[str, Any] = {}
    for path, field_name in KEY_MAP.items():
        node: Any = yaml_dict
        for part in path:
            if not isinstance(node, dict) or part not in node:
                node = None
                break
            node = node[part]
        if node is not None:
            flat[field_name] = node
    return flat


def load_yaml_settings(env: str | None = None) -> dict[str, Any]:
    """Return a flat dict of settings derived from YAML files.

    The ``env`` argument selects which overlay to apply. If ``None``, falls back
    to the ``APP_ENV`` environment variable, then to ``"development"``.
    """
    env = (env or os.getenv(APP_ENV_VAR) or DEFAULT_ENV).lower()
    cfg_dir = _config_dir()

    merged = _read_yaml(cfg_dir / "base.yaml")
    overlay = _read_yaml(cfg_dir / f"{env}.yaml")
    merged = _deep_merge(merged, overlay)
    return _flatten(merged)


__all__ = ["CONFIG_DIR_ENV", "KEY_MAP", "load_yaml_settings"]
