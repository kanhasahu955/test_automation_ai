"""YAML configuration layer tests."""
from __future__ import annotations

from pathlib import Path

import pytest

from app.core import config as config_module
from app.core.config_loader import load_yaml_settings


@pytest.fixture(autouse=True)
def _clear_cache():
    """Make sure each test sees a freshly built Settings instance."""
    config_module.get_settings.cache_clear()
    yield
    config_module.get_settings.cache_clear()


def test_yaml_layer_provides_dev_overlay_values():
    flat = load_yaml_settings("development")
    assert flat["APP_NAME"] == "QualityForge AI"
    assert flat["DB_POOL_SIZE"] == 5  # development overlay overrides base (10)
    assert "http://localhost:5173" in flat["CORS_ORIGINS"]


def test_yaml_layer_production_overlay():
    flat = load_yaml_settings("production")
    assert flat["DB_POOL_SIZE"] == 30
    assert flat["DB_CONNECT_TIMEOUT_S"] == 15
    assert flat["PROFILING_SAMPLE_SIZE"] == 5000


def test_env_var_wins_over_yaml(monkeypatch):
    monkeypatch.setenv("DB_POOL_SIZE", "999")
    settings = config_module._build_settings()
    assert settings.DB_POOL_SIZE == 999


def test_qf_config_dir_redirect(tmp_path: Path, monkeypatch):
    cfg = tmp_path
    (cfg / "base.yaml").write_text("app:\n  name: From-Tmp\n", encoding="utf-8")
    monkeypatch.setenv("QF_CONFIG_DIR", str(cfg))
    monkeypatch.delenv("APP_ENV", raising=False)
    flat = load_yaml_settings()
    assert flat["APP_NAME"] == "From-Tmp"


def test_settings_singleton_cached():
    s1 = config_module.get_settings()
    s2 = config_module.get_settings()
    assert s1 is s2
