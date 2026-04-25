"""QualityForge AI - FastAPI application entrypoint."""
from __future__ import annotations

from contextlib import asynccontextmanager
from importlib import metadata
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session

from app.core.config import settings
from app.core.database import engine, init_db
from app.core.errors import register_error_handlers
from app.core.logger import configure_logging, get_logger
from app.modules.ai_generator.routes import router as ai_router
from app.modules.app_settings.routes import router as app_settings_router
from app.modules.audit_logs.routes import router as audit_router

# ---- Module routers ----
from app.modules.auth.routes import router as auth_router
from app.modules.data_profiling.routes import router as profiling_router
from app.modules.data_sources.routes import router as data_sources_router
from app.modules.environments.routes import router as environments_router
from app.modules.executions.routes import router as executions_router
from app.modules.metadata.routes import router as metadata_router
from app.modules.no_code_flows.routes import router as no_code_router
from app.modules.notifications.routes import router as notifications_router
from app.modules.ops.routes import router as ops_router
from app.modules.projects.routes import router as projects_router
from app.modules.quality_monitoring.routes import router as quality_router
from app.modules.reports.routes import router as reports_router
from app.modules.schedules.routes import router as schedules_router
from app.modules.sql_generator.routes import router as sql_gen_router
from app.modules.stm_converter.routes import router as stm_router
from app.modules.test_cases.routes import router as test_cases_router
from app.modules.test_suites.routes import router as test_suites_router
from app.modules.users.routes import router as users_router

log = get_logger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    log.info("startup", env=settings.APP_ENV)

    init_db()
    with Session(engine) as session:
        from app.bootstrap import ensure_admin_user

        ensure_admin_user(session)

    yield
    log.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        description="AI-powered Quality Engineering Platform",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)

    api = APIRouter(prefix=settings.API_PREFIX)
    api.include_router(auth_router)
    api.include_router(users_router)
    api.include_router(projects_router)
    api.include_router(environments_router)
    api.include_router(test_cases_router)
    api.include_router(test_suites_router)
    api.include_router(no_code_router)
    api.include_router(executions_router)
    api.include_router(ai_router)
    api.include_router(stm_router)
    api.include_router(sql_gen_router)
    api.include_router(data_sources_router)
    api.include_router(profiling_router)
    api.include_router(metadata_router)
    api.include_router(quality_router)
    api.include_router(reports_router)
    api.include_router(schedules_router)
    api.include_router(notifications_router)
    api.include_router(audit_router)
    api.include_router(ops_router)
    api.include_router(app_settings_router)

    @api.get("/health", tags=["health"])
    def health():
        return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}

    @api.get("/version", tags=["health"])
    def version():
        try:
            return {"version": metadata.version("fastapi"), "service": "qualityforge-ai"}
        except Exception:
            return {"version": "unknown", "service": "qualityforge-ai"}

    app.include_router(api)

    # Static deliverables: generated Excel workbooks live in `<repo>/docs/excel`.
    # We expose them at `/static/excel/...` so the in-app docs portal and any
    # internal team can grab them without bouncing through the file system.
    static_root = Path(__file__).resolve().parents[2] / "docs" / "excel"
    if static_root.exists():
        app.mount(
            "/static/excel",
            StaticFiles(directory=static_root),
            name="excel-docs",
        )

    @app.get("/", tags=["health"])
    def root():
        return {
            "name": settings.APP_NAME,
            "docs": "/api/docs",
            "health": f"{settings.API_PREFIX}/health",
        }

    return app


app = create_app()
