"""ID utilities (UUIDs as CHAR(36) per schema)."""
from __future__ import annotations

import uuid


def new_id() -> str:
    return str(uuid.uuid4())
