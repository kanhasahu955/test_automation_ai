# SQL Templates & Queries

All raw SQL emitted or executed by the application lives **here**, never inline in Python.

## Layout

```
backend/sql/
├── templates/
│   └── stm/                       # STM (Source-to-Target Mapping) validations
│       ├── row_count.sql
│       ├── null_check.sql
│       ├── duplicate_check.sql
│       ├── reference_check.sql
│       └── transformation_check.sql
└── queries/                       # Reusable canned queries (none yet)
```

## How templates are rendered

Templates are loaded by `app.utils.sql_loader.SqlLoader` (cached) and rendered with
Python's `str.format_map(...)`. Placeholders use single braces, e.g. `{src_table}`,
`{tgt_col}`, `{expected}`. Any literal `{` or `}` in the SQL must be doubled (`{{`, `}}`).

Variables expected by each STM template:

| Template                    | Required variables                                                          |
| --------------------------- | --------------------------------------------------------------------------- |
| `row_count.sql`             | `src_table`, `tgt_table`                                                    |
| `null_check.sql`            | `tgt_table`, `tgt_col`                                                      |
| `duplicate_check.sql`       | `tgt_table`, `tgt_col`                                                      |
| `reference_check.sql`       | `src_table`, `tgt_table`, `join_key`, `tgt_col`                             |
| `transformation_check.sql`  | `src_table`, `tgt_table`, `join_key`, `tgt_col`, `expected`                 |

## Adding a new template

1. Drop a `.sql` file under the appropriate folder.
2. Use single-brace placeholders.
3. Reference it via `SqlLoader.render("stm/<name>", **vars)`.
4. The loader **fails loudly** on missing files or missing variables — both desirable.

## Why a folder, not Python strings?

- Editor SQL highlighting, formatting, validation.
- Easy diffing in PR review.
- Test fixtures can read the same file the runtime uses.
- DBAs can review/modify SQL without touching Python.
- Identical pattern works for raw queries and migrations (Alembic still owns DDL — see `backend/alembic/`).
