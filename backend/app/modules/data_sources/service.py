"""Data source services."""
from __future__ import annotations

from urllib.parse import quote, urlencode

from sqlalchemy import create_engine, inspect, text
from sqlmodel import Session, select

from app.core.config import settings
from app.core.errors import NotFoundError
from app.core.security import decrypt_secret, encrypt_secret
from app.modules.data_sources.models import DataSource
from app.modules.data_sources.schemas import (
    DataSourceCreate,
    DataSourceUpdate,
    TestConnectionResult,
)
from app.utils.sql_loader import sql_loader

# System schemas we usually hide from the "pick a database" list (MySQL).
_MYSQL_SKIP_DATABASES = frozenset({"information_schema", "performance_schema", "mysql", "sys"})


def create(session: Session, project_id: str, payload: DataSourceCreate) -> DataSource:
    data = payload.model_dump(exclude={"password"})
    encrypted = encrypt_secret(payload.password) if payload.password else None
    ds = DataSource(project_id=project_id, encrypted_password=encrypted, **data)
    session.add(ds)
    session.commit()
    session.refresh(ds)
    return ds


def list_(session: Session, project_id: str) -> list[DataSource]:
    return session.exec(
        select(DataSource).where(DataSource.project_id == project_id).order_by(DataSource.created_at.desc())
    ).all()


def get(session: Session, ds_id: str) -> DataSource:
    ds = session.exec(select(DataSource).where(DataSource.id == ds_id)).first()
    if not ds:
        raise NotFoundError("Data source not found")
    return ds


def update(session: Session, ds_id: str, payload: DataSourceUpdate) -> DataSource:
    ds = get(session, ds_id)
    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        password = data.pop("password")
        ds.encrypted_password = encrypt_secret(password) if password else None
    for key, value in data.items():
        setattr(ds, key, value)
    session.add(ds)
    session.commit()
    session.refresh(ds)
    return ds


def delete(session: Session, ds_id: str) -> None:
    ds = get(session, ds_id)
    session.delete(ds)
    session.commit()


def get_password(ds: DataSource) -> str:
    return decrypt_secret(ds.encrypted_password or "")


def _auth_parts(ds: DataSource) -> tuple[str, str, str, int]:
    pwd = get_password(ds)
    user = quote(ds.username or "", safe="")
    password = quote(pwd, safe="")
    host = ds.host or "localhost"
    return user, password, host, int(ds.port or (3306 if ds.source_type == "MYSQL" else 5432))


def _postgres_url_query(ds: DataSource) -> str:
    """Build query string for libpq (Neon / Supabase need sslmode; local often prefer/disable)."""
    extra = dict(ds.extra_config or {})
    params: dict[str, str] = {}
    if extra.get("sslmode") is not None:
        params["sslmode"] = str(extra["sslmode"])
    for key in ("connect_timeout", "options"):
        if extra.get(key) is not None:
            params[key] = str(extra[key])
    if not params:
        params["sslmode"] = "prefer"
    return "?" + urlencode(params)


def build_engine_url_for_database(ds: DataSource, database: str) -> str | None:
    """Build URL for a specific catalog (used by saved *database_name* and live browser)."""
    if ds.source_type not in ("MYSQL", "POSTGRESQL"):
        return None
    name = (database or "").strip()
    if not name:
        return None
    user, password, host, prt = _auth_parts(ds)
    db = quote(name, safe="")
    if ds.source_type == "MYSQL":
        return f"mysql+pymysql://{user}:{password}@{host}:{prt}/{db}?charset=utf8mb4"
    q = _postgres_url_query(ds)
    return f"postgresql+psycopg2://{user}:{password}@{host}:{prt}/{db}{q}"


def build_engine_url_for_data(ds: DataSource) -> str | None:
    """URL for saved *database_name* (metadata scan, profiling, etc.)."""
    return build_engine_url_for_database(ds, ds.database_name or "")


def build_engine_url_for_test(ds: DataSource) -> str | None:
    """URL for *Test connection* and *list databases*.

    If no database is configured, connects without a default catalog (MySQL) or
    to the built-in ``postgres`` database (PostgreSQL).
    """
    if ds.source_type not in ("MYSQL", "POSTGRESQL"):
        return None
    user, password, host, prt = _auth_parts(ds)
    name = (ds.database_name or "").strip()
    if ds.source_type == "MYSQL":
        if name:
            db = quote(name, safe="")
            return f"mysql+pymysql://{user}:{password}@{host}:{prt}/{db}?charset=utf8mb4"
        return f"mysql+pymysql://{user}:{password}@{host}:{prt}/?charset=utf8mb4"
    if name:
        db = quote(name, safe="")
        q = _postgres_url_query(ds)
        return f"postgresql+psycopg2://{user}:{password}@{host}:{prt}/{db}{q}"
    # Connect to an always-present maintenance DB to list others / validate login.
    q = _postgres_url_query(ds)
    return f"postgresql+psycopg2://{user}:{password}@{host}:{prt}/postgres{q}"


# Backwards compatibility for workers importing the old name.
def _build_sqlalchemy_url(ds: DataSource) -> str | None:
    return build_engine_url_for_data(ds)


def test_connection(ds: DataSource) -> TestConnectionResult:
    """Best-effort connection test. Doesn't raise — returns ok flag."""
    try:
        url = build_engine_url_for_test(ds)
        if not url:
            return TestConnectionResult(
                ok=False,
                message=f"Connection test for {ds.source_type} is not supported this way; fill in host, user, and password.",
            )
        engine = create_engine(
            url,
            pool_pre_ping=True,
            connect_args={"connect_timeout": settings.DB_CONNECT_TIMEOUT_S},
        )
        ping_sql = sql_loader.load("queries/health/ping").rstrip(";").strip()
        with engine.connect() as conn:
            conn.execute(text(ping_sql))
        return TestConnectionResult(ok=True, message="Connection successful")
    except Exception as exc:  # pragma: no cover
        return TestConnectionResult(ok=False, message=str(exc))


def list_databases_on_server(session: Session, ds_id: str) -> list[str]:
    """List database names the login can see (MySQL: SHOW DATABASES; Postgres: pg_database)."""
    ds = get(session, ds_id)
    url = build_engine_url_for_test(ds)
    if not url:
        return []
    engine = create_engine(
        url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": settings.DB_CONNECT_TIMEOUT_S},
    )
    with engine.connect() as conn:
        if ds.source_type == "MYSQL":
            rows = conn.execute(text("SHOW DATABASES"))
            out = [r[0] for r in rows if r[0] not in _MYSQL_SKIP_DATABASES]
        elif ds.source_type == "POSTGRESQL":
            rows = conn.execute(
                text("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")
            )
            out = [r[0] for r in rows]
        else:
            return []
    return list(out)


def _assert_live_sql_param(label: str, value: str | None, *, max_len: int = 256) -> str:
    v = (value or "").strip()
    if not v or len(v) > max_len:
        raise ValueError(f"Invalid {label}")
    if ";" in v or "\x00" in v or "`" in v or '"' in v:
        raise ValueError(f"Invalid {label}")
    return v


def _live_engine(ds: DataSource, database: str):
    url = build_engine_url_for_database(ds, database)
    if not url:
        raise ValueError("Could not build connection URL for this database")
    return create_engine(
        url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": settings.DB_CONNECT_TIMEOUT_S},
    )


def live_list_tables(session: Session, ds_id: str, database: str) -> list[dict]:
    """Introspect table names in *database* (no Celery scan)."""
    db = _assert_live_sql_param("database", database, max_len=128)
    ds = get(session, ds_id)
    if ds.source_type not in ("MYSQL", "POSTGRESQL"):
        raise ValueError("Live inspection is only supported for MySQL and PostgreSQL")
    engine = _live_engine(ds, db)
    try:
        insp = inspect(engine)
        cap = settings.METADATA_MAX_TABLES
        out: list[dict] = []
        # Reflectors / drivers can rarely emit the same (schema, table) twice; de-dupe for stable UI.
        seen: set[tuple[str | None, str]] = set()

        def add_once(sch: str | None, tname: str) -> bool:
            key = (sch, tname)
            if key in seen:
                return False
            seen.add(key)
            return True

        if ds.source_type == "POSTGRESQL":
            system_pg = {"information_schema", "pg_catalog", "pg_toast"}
            for schema in insp.get_schema_names():
                if schema in system_pg or schema.startswith("pg_temp_"):
                    continue
                for tname in insp.get_table_names(schema=schema):
                    if len(out) >= cap:
                        break
                    if not add_once(schema, tname):
                        continue
                    out.append({"schema_name": schema, "table_name": tname})
                if len(out) >= cap:
                    break
        else:
            for tname in insp.get_table_names():
                if len(out) >= cap:
                    break
                if not add_once(None, tname):
                    continue
                out.append({"schema_name": None, "table_name": tname})
        return out
    finally:
        engine.dispose()


def live_list_columns(
    session: Session, ds_id: str, database: str, table: str, schema: str | None = None
) -> list[dict]:
    """Column details for one table via ``inspect.get_columns``."""
    db = _assert_live_sql_param("database", database, max_len=128)
    tbl = _assert_live_sql_param("table", table, max_len=256)
    sch_raw = (schema or "").strip()
    ds = get(session, ds_id)
    if ds.source_type not in ("MYSQL", "POSTGRESQL"):
        raise ValueError("Live inspection is only supported for MySQL and PostgreSQL")
    schema_kw: str | None = None
    if ds.source_type == "POSTGRESQL":
        schema_kw = _assert_live_sql_param("schema", sch_raw or "public", max_len=256)
    elif sch_raw:
        raise ValueError("Schema is only used for PostgreSQL")
    engine = _live_engine(ds, db)
    try:
        insp = inspect(engine)
        pk_info = insp.get_pk_constraint(tbl, schema=schema_kw)
        pks = set(pk_info.get("constrained_columns") or [])
        fk_cols: set[str] = set()
        for fk in insp.get_foreign_keys(tbl, schema=schema_kw):
            for c in fk.get("constrained_columns") or []:
                fk_cols.add(c)
        out: list[dict] = []
        for col in insp.get_columns(tbl, schema=schema_kw):
            name = col["name"]
            default = col.get("default")
            out.append(
                {
                    "name": name,
                    "data_type": str(col.get("type", "")),
                    "nullable": bool(col.get("nullable", True)),
                    "is_pk": name in pks,
                    "is_fk": name in fk_cols,
                    "default": str(default) if default is not None else None,
                    "autoincrement": col.get("autoincrement"),
                    "comment": (col.get("comment") or None),
                }
            )
        return out
    finally:
        engine.dispose()


def live_list_relations(session: Session, ds_id: str, database: str) -> list[dict]:
    """Foreign keys as directed column pairs, for diagramming."""
    db = _assert_live_sql_param("database", database, max_len=128)
    ds = get(session, ds_id)
    if ds.source_type not in ("MYSQL", "POSTGRESQL"):
        raise ValueError("Live inspection is only supported for MySQL and PostgreSQL")
    engine = _live_engine(ds, db)
    try:
        insp = inspect(engine)
        out: list[dict] = []
        cap = settings.METADATA_MAX_TABLES
        table_count = 0
        if ds.source_type == "POSTGRESQL":
            system_pg = {"information_schema", "pg_catalog", "pg_toast"}
            for schema in insp.get_schema_names():
                if schema in system_pg or schema.startswith("pg_temp_"):
                    continue
                for tname in insp.get_table_names(schema=schema):
                    if table_count >= cap:
                        break
                    table_count += 1
                    for fk in insp.get_foreign_keys(tname, schema=schema):
                        conf = fk.get("constrained_columns") or []
                        refc = fk.get("referred_columns") or []
                        rtable = fk.get("referred_table")
                        rschema = fk.get("referred_schema")
                        if not rtable or not conf:
                            continue
                        for i, cc in enumerate(conf):
                            rc = refc[i] if i < len(refc) else refc[-1]
                            out.append(
                                {
                                    "constrained_schema": schema,
                                    "constrained_table": tname,
                                    "constrained_column": cc,
                                    "referred_schema": rschema,
                                    "referred_table": rtable,
                                    "referred_column": rc,
                                }
                            )
                if table_count >= cap:
                    break
        else:
            for tname in insp.get_table_names()[:cap]:
                for fk in insp.get_foreign_keys(tname, schema=None):
                    conf = fk.get("constrained_columns") or []
                    refc = fk.get("referred_columns") or []
                    rtable = fk.get("referred_table")
                    rschema = fk.get("referred_schema")
                    if not rtable or not conf:
                        continue
                    for i, cc in enumerate(conf):
                        rc = refc[i] if i < len(refc) else refc[-1]
                        out.append(
                            {
                                "constrained_schema": None,
                                "constrained_table": tname,
                                "constrained_column": cc,
                                "referred_schema": rschema,
                                "referred_table": rtable,
                                "referred_column": rc,
                            }
                        )
        return out
    finally:
        engine.dispose()
