"""Centralized error handling.

Every error response leaves the API in a single, predictable envelope so the
frontend never has to guess which shape it's dealing with::

    { "error": { "code": "...", "message": "...", "details"?: {...} } }

This is enforced by registering exception handlers for:

* :class:`AppError` and subclasses (our domain exceptions)
* :class:`fastapi.HTTPException` / :class:`starlette.exceptions.HTTPException`
  — used by ``permissions.py`` and any third-party dependency that raises one
* :class:`fastapi.exceptions.RequestValidationError` — pydantic 422s
* :class:`sqlalchemy.exc.IntegrityError` / :class:`SQLAlchemyError`
* a final ``Exception`` catch-all so an uncaught bug never leaks an HTML 500
  page (or worse, a stack trace) to the browser

If you ever see ``{"detail": "..."}`` in a response, a handler is missing.
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logger import get_logger

log = get_logger("errors")

# Map HTTP status codes to short, machine-readable error codes that the
# frontend can branch on without parsing free-form messages.
_STATUS_CODE_MAP: dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    408: "request_timeout",
    409: "conflict",
    410: "gone",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "unprocessable_entity",
    429: "too_many_requests",
    500: "internal_error",
    501: "not_implemented",
    502: "bad_gateway",
    503: "service_unavailable",
    504: "gateway_timeout",
}


def _code_for_status(status_code: int) -> str:
    return _STATUS_CODE_MAP.get(status_code, "http_error")


class AppError(Exception):
    """Base application exception."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "app_error"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None,
                 extra: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.extra = extra or {}
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class ValidationFailed(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "validation_failed"


class PermissionDenied(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "permission_denied"


def _payload(message: str, code: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"error": {"code": code, "message": message}}
    if extra:
        body["error"]["details"] = extra
    return body


def _http_exception_payload(exc: HTTPException | StarletteHTTPException) -> JSONResponse:
    """Re-wrap an ``HTTPException`` into our standard envelope.

    FastAPI's default body is ``{"detail": ...}`` where ``detail`` may be a
    string, a dict, or a list of pydantic errors. We normalize that here so
    the frontend only ever has to look at ``error.message`` / ``error.details``.
    """
    detail = exc.detail
    code = _code_for_status(exc.status_code)
    extra: dict[str, Any] | None = None

    if isinstance(detail, str):
        message = detail
    elif isinstance(detail, dict):
        message = str(detail.get("message") or detail.get("msg") or _default_message(exc.status_code))
        extra = {k: v for k, v in detail.items() if k not in {"message", "msg"}} or None
    elif isinstance(detail, list):
        message = _default_message(exc.status_code)
        extra = {"errors": detail}
    else:
        message = _default_message(exc.status_code)

    headers = getattr(exc, "headers", None)
    return JSONResponse(
        status_code=exc.status_code,
        content=_payload(message, code, extra),
        headers=headers,
    )


def _default_message(status_code: int) -> str:
    """Human-readable fallback used when an HTTPException has no string detail."""
    return {
        400: "Bad request",
        401: "Authentication required",
        403: "You don't have permission to perform this action",
        404: "Resource not found",
        405: "Method not allowed",
        409: "Conflict",
        422: "Validation failed",
        429: "Too many requests — please slow down",
        500: "Something went wrong on our side",
        502: "Upstream service is unavailable",
        503: "Service temporarily unavailable",
        504: "Upstream service timed out",
    }.get(status_code, "Request failed")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(exc.message, exc.code, exc.extra or None),
        )

    @app.exception_handler(HTTPException)
    async def _http_exception(_: Request, exc: HTTPException):
        return _http_exception_payload(exc)

    @app.exception_handler(StarletteHTTPException)
    async def _starlette_http_exception(_: Request, exc: StarletteHTTPException):
        return _http_exception_payload(exc)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        # Surface the first field error in the top-level message so toasts
        # (which typically render only `error.message`) are still helpful;
        # full structured errors stay in `details` for forms that want them.
        errors = exc.errors()
        first = errors[0] if errors else None
        if first:
            field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
            message = f"{field}: {first.get('msg', 'invalid value')}" if field else first.get("msg", "Validation failed")
        else:
            message = "Validation failed"
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_payload(message, "validation_failed", {"errors": errors}),
        )

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError):
        log.warning("db.integrity_error", error=str(exc.orig) if exc.orig else str(exc))
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=_payload(
                "This change conflicts with existing data",
                "integrity_error",
            ),
        )

    @app.exception_handler(SQLAlchemyError)
    async def _db_error(_: Request, exc: SQLAlchemyError):
        log.error("db.error", error=str(exc), exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_payload("Database error", "database_error"),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        # Catch-all: never let an uncaught exception escape as an HTML 500.
        # Internal details go to the structured logs, *not* the response body.
        log.error("unhandled_exception", error=repr(exc), exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_payload(
                "Something went wrong on our side. Please try again.",
                "internal_error",
            ),
        )
