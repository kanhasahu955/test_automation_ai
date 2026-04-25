# Using the App

A screen-by-screen walk-through of the QualityForge UI.

## Dashboard

Your home base. Shows:

- Active project picker (top-right of the header).
- KPI cards: total tests, executions today, pass rate, defect density.
- Recent activity feed and pinned reports.

> Pick a project before you create test cases or executions — most pages
> filter by the active project.

## Projects

Create and manage projects. A project owns:

- Test cases, suites, flows.
- Data sources (connections).
- STM mappings.
- Reports and audit history.

Open a project for a deep view (members, settings, integrations, danger zone).

## Test Management

- **Test Cases** — CRUD, tags, priority, expected results, traceability links.
- **Test Suites** — group test cases into runnable bundles.
- Bulk actions: import from CSV, clone, retag, archive.

## No-Code Designer

Drag-and-drop flow editor (powered by React Flow). Each node is an action
(API call, DB query, assertion, AI step, etc.). The designer compiles the
graph into an executable plan.

- `/flows` — list and manage flows.
- `/flows/new` — author a new flow.
- `/flows/:flowId` — edit an existing flow.

## AI Studio

Generate tests from natural language. Pick a model, describe intent,
preview generated test cases, and import the ones you want.

- Saves prompt history per project.
- Supports few-shot examples and JSON-schema-constrained outputs.

## STM Converter

Paste a Source-to-Target Mapping (or upload Excel) and produce SQL validation
queries automatically. Templates live in `backend/sql/templates/stm/`:

| Validation        | Template               |
|-------------------|------------------------|
| Row count         | `row_count.sql`        |
| Null check        | `null_check.sql`       |
| Duplicate check   | `duplicate_check.sql`  |
| Reference check   | `reference_check.sql`  |
| Transformation    | `transformation_check.sql` |

You can preview the SQL before saving. The renderer is typed via
`StmMappingSpec`, so adding a new validation type means: add a template,
add a `ValidationType`, render.

## Data Profiling

Connect a source, choose tables/columns, and run a profile. The job is
delegated to a **Celery** worker so the UI stays responsive. Outputs:

- Distinct counts, null ratios, min / max / mean.
- Top values and patterns.
- Drift comparisons against a previous run.

## Metadata Explorer

Browse data sources, schemas, tables, and columns. Useful for picking
columns for STM mappings or test assertions.

## Quality Monitoring

Real-time dashboards for execution health, failure trends, MTTR. Set
thresholds + alert channels (email, Slack, webhook) in **Settings**.

## Executions

Trigger or schedule runs of test cases / suites / flows. Detail view shows:

- Step-by-step logs (streamed).
- Diff between expected and actual.
- Re-run, mark as defect, link to issue tracker.

## Reports

Curated views per project: regression summary, weekly trends, exportable PDFs.
Background generation runs through Celery; large rollups go through Airflow.

## Audit Logs

Append-only stream of "who did what, when". Filter by user, action,
resource. Useful for compliance audits.

## Notifications · Settings · Profile

- **Notifications** — mark read, mute, integrate with Slack/email/webhook.
- **Settings** — workspace, members, API keys, integrations, theme.
- **Profile menu (top-right)** — quick links to docs, settings, sign-out.

> Tip: every screen is keyboard-friendly. Press `?` to bring up the shortcuts
> overlay (coming soon — toggleable in Settings → Experimental).
