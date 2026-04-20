"""Sync DB engine for retrieval modules."""

from __future__ import annotations

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from app.core.config import settings


def _sync_db_url() -> str:
    return settings.db_url.replace("postgresql+asyncpg://", "postgresql://")


@lru_cache(maxsize=1)
def get_sync_engine() -> Engine:
    return create_engine(_sync_db_url(), pool_pre_ping=True)
