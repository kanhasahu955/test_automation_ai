"""Playwright runner entrypoint.
Reads a script path from env QF_SCRIPT_PATH, executes it, dumps a JSON report.
"""
from __future__ import annotations

import json
import os
import runpy
import sys
import time
import traceback


def main() -> int:
    script = os.environ.get("QF_SCRIPT_PATH")
    if not script:
        print(json.dumps({"ok": False, "error": "QF_SCRIPT_PATH not set"}))
        return 1
    started = time.time()
    try:
        runpy.run_path(script, run_name="__main__")
        print(json.dumps({"ok": True, "duration_ms": int((time.time() - started) * 1000)}))
        return 0
    except Exception:
        print(json.dumps({
            "ok": False,
            "duration_ms": int((time.time() - started) * 1000),
            "error": traceback.format_exc(),
        }))
        return 1


if __name__ == "__main__":
    sys.exit(main())
