"""SQL runner entrypoint.

Reads SQL from QF_SQL or QF_SQL_FILE and a connection URL from QF_DB_URL.
Returns rows as JSON.
"""
from __future__ import annotations

import json
import os
import sys


def main() -> int:
    url = os.environ.get("QF_DB_URL")
    sql = os.environ.get("QF_SQL")
    sql_file = os.environ.get("QF_SQL_FILE")
    if sql_file and os.path.exists(sql_file):
        with open(sql_file) as f:
            sql = f.read()
    if not url or not sql:
        print(json.dumps({"ok": False, "error": "QF_DB_URL and QF_SQL/QF_SQL_FILE required"}))
        return 1
    try:
        from sqlalchemy import create_engine, text

        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            rows = [dict(row._mapping) for row in result.fetchmany(500)]
        print(json.dumps({"ok": True, "row_count": len(rows), "rows": rows}, default=str))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
