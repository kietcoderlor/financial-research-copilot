"""Redis cache for /query responses."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

_TTL_SECONDS = 24 * 3600
_CACHE_VERSION = "v3"


def _client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def cache_key(question: str, filters: dict[str, Any]) -> str:
    payload = json.dumps(
        {"v": _CACHE_VERSION, "question": question, "filters": filters},
        sort_keys=True,
        ensure_ascii=True,
    )
    h = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return f"query:{h}"


def get_cached(key: str) -> dict[str, Any] | None:
    try:
        raw = _client().get(key)
        return json.loads(raw) if raw else None
    except (RedisError, json.JSONDecodeError, TypeError):
        return None


def put_cached(key: str, value: dict[str, Any]) -> None:
    try:
        _client().setex(key, _TTL_SECONDS, json.dumps(value, ensure_ascii=True))
    except RedisError:
        return
