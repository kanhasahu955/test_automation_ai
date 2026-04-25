"""Data source services."""
from __future__ import annotations

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


def test_connection(ds: DataSource) -> TestConnectionResult:
    """Best-effort connection test. Doesn't raise — returns ok flag."""
    try:
        from sqlalchemy import create_engine, text  # local import

        url = _build_sqlalchemy_url(ds)
        if not url:
            return TestConnectionResult(ok=False, message=f"Connection test for {ds.source_type} not implemented")
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


def _build_sqlalchemy_url(ds: DataSource) -> str | None:
    pwd = get_password(ds)
    if ds.source_type == "MYSQL":
        return f"mysql+pymysql://{ds.username}:{pwd}@{ds.host}:{ds.port}/{ds.database_name}?charset=utf8mb4"
    if ds.source_type == "POSTGRESQL":
        return f"postgresql+psycopg2://{ds.username}:{pwd}@{ds.host}:{ds.port}/{ds.database_name}"
    return None
