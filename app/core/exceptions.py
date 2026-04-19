import json
import logging
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or "unknown"


def _error_body(message: Any, request_id: str) -> dict[str, Any]:
    return {"error": message, "request_id": request_id}


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    rid = _request_id(request)
    detail = exc.detail
    message = detail if isinstance(detail, str) else json.dumps(detail, default=str)
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(message, rid),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    rid = _request_id(request)
    return JSONResponse(
        status_code=422,
        content=_error_body(exc.errors(), rid),
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    rid = _request_id(request)
    logging.getLogger("app.error").exception(
        "unhandled",
        extra={"request_id": rid, "path": request.url.path},
    )
    return JSONResponse(
        status_code=500,
        content=_error_body("Internal server error", rid),
    )
