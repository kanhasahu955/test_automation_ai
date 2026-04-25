"""Tests for the no-code DSL compiler."""
from __future__ import annotations

from app.modules.no_code_flows.compiler import compile_flow
from app.modules.no_code_flows.models import FlowRuntime


def test_compile_playwright_basic_flow():
    flow = {
        "flow_name": "Login",
        "steps": [
            {"type": "open_page", "config": {"url": "https://app.com/login"}},
            {"type": "input", "config": {"selector": "#email", "value": "a@b.com"}},
            {"type": "click", "config": {"selector": "#go"}},
            {"type": "assert_visible", "config": {"selector": "#dashboard"}},
        ],
    }
    script, warnings = compile_flow(flow, FlowRuntime.PLAYWRIGHT)
    assert "page.goto('https://app.com/login')" in script
    assert "page.fill('#email', 'a@b.com')" in script
    assert "page.click('#go')" in script
    assert "to_be_visible" in script
    assert warnings == []


def test_compile_pytest_api():
    flow = {
        "flow_name": "Login API",
        "steps": [
            {
                "type": "api_request",
                "config": {
                    "method": "POST",
                    "url": "https://api/login",
                    "headers": {"Content-Type": "application/json"},
                    "body": {"email": "a@b.com"},
                },
            },
            {"type": "assert_status_code", "config": {"expected": 200}},
        ],
    }
    script, warnings = compile_flow(flow, FlowRuntime.PYTEST_API)
    assert "httpx.post" in script
    assert "response.status_code == 200" in script
    assert warnings == []
