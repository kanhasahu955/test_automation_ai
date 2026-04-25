"""PyTest runner entrypoint.

Runs pytest against a test directory mounted at /tests and exits with pytest's status.
"""
from __future__ import annotations

import os
import subprocess
import sys


def main() -> int:
    tests_dir = os.environ.get("QF_TESTS_DIR", "/tests")
    args = ["pytest", "-q", tests_dir]
    return subprocess.call(args)


if __name__ == "__main__":
    sys.exit(main())
