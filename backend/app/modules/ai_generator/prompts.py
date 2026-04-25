"""Prompt templates for AI features."""
from __future__ import annotations

GENERATE_TEST_CASES = """You are a senior QA engineer.
Generate functional, negative, edge-case, and security test cases for the following requirement.

Requirement:
{requirement}

Return strictly a JSON array with at most {count} items. Each item shape:
{{
  "title": str,
  "description": str,
  "preconditions": str,
  "steps": [{{"step_order": int, "action": str, "expected_result": str}}],
  "expected_result": str,
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "test_type": "MANUAL" | "API" | "UI" | "SQL" | "DATA_QUALITY" | "NO_CODE"
}}
"""


GENERATE_SQL_FROM_STM = """You are a senior data validation engineer.
Convert the following source-to-target mapping into ANSI SQL validation logic.

Mapping JSON:
{mapping_json}

Rules:
- Use source alias s and target alias t
- Return rows ONLY when validation FAILS
- Output a single SQL statement with no markdown, no commentary
- Generate ANSI SQL where possible
"""


ANALYZE_FAILURE = """You are a test automation failure analyst.
Analyze the following test failure and explain likely root cause.

Test Name: {test_name}

Error:
{error_message}

Logs:
{logs}

Return JSON with:
{{
  "summary": str,
  "likely_root_cause": str,
  "suggested_fix": str,
  "is_flaky": bool
}}
"""


GENERATE_NO_CODE_FLOW = """You are a senior QA engineer.
Generate a no-code DSL flow JSON for the following scenario.

Scenario:
{scenario}

Return JSON only with shape:
{{
  "flow_name": str,
  "runtime": "PLAYWRIGHT" | "PYTEST_API" | "SQL",
  "steps": [{{"id": str, "type": str, "config": dict}}]
}}
"""


SUGGEST_EDGE_CASES = """You are a QA strategist.
Given the requirement below, list edge cases that are commonly missed.

Requirement:
{requirement}

Return a JSON array of strings.
"""


GENERATE_STM_SCENARIOS = """You are a senior data validation engineer.
Draft Source-to-Target Mapping (STM) test scenarios for the requirement below.

Scenario / requirement:
{scenario}

Optional hints (may be empty):
- Target table: {target_table}
- Candidate source tables: {source_tables}

Return strictly a JSON array of at most {count} mapping objects. Each item shape:
{{
  "source_table": str | null,
  "source_column": str | null,
  "target_table": str | null,
  "target_column": str | null,
  "join_key": str | null,
  "transformation_rule": str | null,
  "validation_type": "ROW_COUNT" | "NULL_CHECK" | "DUPLICATE_CHECK" | "TRANSFORMATION_CHECK" | "REFERENCE_CHECK"
}}

Cover the four classic categories: row counts, null/required checks,
duplicate/uniqueness, and transformation correctness. Prefer realistic
column names inferred from the scenario. No prose, no markdown.
"""
