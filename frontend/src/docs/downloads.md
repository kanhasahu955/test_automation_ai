# Downloads — Excel deliverables

The platform ships three opinionated Excel workbooks. They are auto-generated
from the live OpenAPI schema and the actual Pydantic / SQLModel definitions —
running `make excel-docs` rebuilds them so they never drift from the
codebase.

> All files live under `docs/excel/` in the repository. When the API server is
> running, they are served at `/static/excel/<filename>` so you can link to them
> from anywhere.

---

## 1. Complete API reference

**File:** `qualityforge-ai_api_reference.xlsx`

Sheets included:

| Sheet | What's inside |
| --- | --- |
| **Overview** | Service info, base URL, auth, error envelope, regeneration command. |
| **Index** | Every endpoint at a glance — sortable / filterable. Each row hyperlinks to the per-tag detail sheet. |
| **<Tag>** sheets | One per API group (`auth`, `projects`, `executions`, `stm`, …). Each endpoint block contains: summary, description, auth, **parameters table** (path/query/header), **request body schema** + JSON example, **response schemas + examples** for every status code. |
| **Schemas** | Every Pydantic model — one row per field with type, required flag, default, description, constraints. |
| **Enums** | Every enum the API exposes (`RunStatus`, `ValidationType`, `ResultStatus`, …). |

[Download API reference workbook](/static/excel/qualityforge-ai_api_reference.xlsx)

---

## 2. STM upload template

**File:** `qualityforge-ai_stm_upload_template.xlsx`

This is the Excel users fill in when uploading a Source-to-Target Mapping
document via `POST /api/v1/projects/{project_id}/stm/upload`. The headers and
aliases match exactly what the backend's `parse_stm_excel` accepts.

Sheets included:

| Sheet | Purpose |
| --- | --- |
| **Instructions** | Endpoint, auth, accepted aliases, what each column means. |
| **Mappings** | The blank template you fill in. `validation_type` has a drop-down so you cannot pick an invalid value. |
| **Examples** | One row per `ValidationType` (`ROW_COUNT`, `NULL_CHECK`, `DUPLICATE_CHECK`, `TRANSFORMATION_CHECK`, `REFERENCE_CHECK`) plus composite-join-key and currency-conversion variants — copy a row and adapt. |
| **Lookups** | SQL template paths + the most common pitfalls and their fixes. |

[Download STM upload template](/static/excel/qualityforge-ai_stm_upload_template.xlsx)

### Quick recipe

1. Download the file above.
2. Fill in the `Mappings` sheet (use the drop-down for `Validation Type`).
3. Upload via the **STM Converter** screen, or via API:

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@my_mappings.xlsx" \
  http://localhost:8080/api/v1/projects/<project_id>/stm/upload
```

---

## 3. Schedule executions

**File:** `qualityforge-ai_schedule_executions.xlsx`

A bulk-import template for scheduled, CI-driven, manual or Airflow-triggered
runs. The columns mirror the `RunType` enum and the executions API contract,
so a future bulk-schedule import endpoint can read this file directly.

Sheets included:

| Sheet | Purpose |
| --- | --- |
| **Instructions** | What the workbook is for, audience, definitions. |
| **Schedules** | Blank template (20 columns) with drop-downs on `target_type`, `run_type`, `enabled`. |
| **Examples** | Six realistic schedules: nightly regression, hourly smoke, weekly STM, CI/CD, disabled manual, 15-minute drift watch. |
| **Cron Reference** | Cron cookbook (every 5 min, daily, weekdays, monthly, …) and field reference. |
| **Run Types** | What `MANUAL`, `SCHEDULED`, `CI_CD`, `AIRFLOW` mean. |
| **Run Status** | Lifecycle of an `execution_run`. |
| **Result Status** | Per-test outcome semantics. |

[Download schedule executions template](/static/excel/qualityforge-ai_schedule_executions.xlsx)

---

## Regeneration

When models or routes change, regenerate all three files:

```bash
make excel-docs
```

This runs `backend/scripts/build_excel_docs.py`, which reads the live OpenAPI
schema (no server needed) and writes fresh `.xlsx` files into `docs/excel/`.
