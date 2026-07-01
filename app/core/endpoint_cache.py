"""Redis read-through cache for /query and /retrieve (P7-A2)."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)


def _client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def endpoint_cache_key(endpoint: str, payload: dict[str, Any]) -> str:
    body = json.dumps(payload, sort_keys=True, ensure_ascii=True)
    h = hashlib.sha256(f"{endpoint}:{body}".encode("utf-8")).hexdigest()
    return f"epcache:{endpoint}:{h}"


def get_endpoint_cached(key: str) -> dict[str, Any] | None:
    try:
        raw = _client().get(key)
        if raw:
            logger.info("endpoint_cache event=hit key=%s", key[:24])
            return json.loads(raw)
    except (RedisError, json.JSONDecodeError, TypeError):
        return None
    logger.info("endpoint_cache event=miss key=%s", key[:24])
    return None


def put_endpoint_cached(key: str, value: dict[str, Any]) -> None:
    try:
        _client().setex(key, settings.query_cache_ttl_seconds, json.dumps(value, ensure_ascii=True))
    except RedisError:
        return
