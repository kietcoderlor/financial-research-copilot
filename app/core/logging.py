import json
import logging
import sys
import time
import uuid
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


def setup_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.setLevel(level.upper())
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        root.addHandler(handler)


def _log_record(payload: dict[str, Any]) -> None:
    logging.getLogger("app.request").info(json.dumps(payload, default=str))


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = int((time.perf_counter() - start) * 1000)
            _log_record(
                {
                    "request_id": request_id,
                    "path": request.url.path,
                    "method": request.method,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                }
            )
            raise

        duration_ms = int((time.perf_counter() - start) * 1000)
        _log_record(
            {
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            }
        )
        return response
