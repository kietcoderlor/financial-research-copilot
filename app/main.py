from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.health import router as health_router
from app.api.ingest import router as ingest_router
from app.api.meta import router as meta_router
from app.api.query import router as query_router
from app.api.retrieve import router as retrieve_router
from app.core.config import settings
from app.core.exceptions import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.logging import LoggingMiddleware, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    setup_logging(settings.log_level)
    application = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    application.add_middleware(LoggingMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_exception_handler(StarletteHTTPException, http_exception_handler)
    application.add_exception_handler(RequestValidationError, validation_exception_handler)
    application.add_exception_handler(Exception, generic_exception_handler)
    application.include_router(health_router, tags=["health"])
    application.include_router(ingest_router)
    application.include_router(retrieve_router)
    application.include_router(query_router)
    application.include_router(meta_router)
    return application


app = create_app()
