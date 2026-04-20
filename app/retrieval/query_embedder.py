"""Query embedding + Redis cache."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from openai import OpenAI
from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 3600
_EMBED_DIM = 1536
_EMBED_MODEL = "text-embedding-3-small"


def _redis_client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def _cache_key(query: str) -> str:
    h = hashlib.sha256(query.encode("utf-8")).hexdigest()
    return f"embed:{h}"


def _embed_live(query: str) -> list[float]:
    if not settings.openai_api_key:
        logger.warning("query_embed_stub_used reason=no_openai_api_key")
        return [0.0] * _EMBED_DIM
    client = OpenAI(api_key=settings.openai_api_key)
    resp = client.embeddings.create(model=_EMBED_MODEL, input=[query])
    return list(resp.data[0].embedding)


def embed_query(query: str) -> list[float]:
    key = _cache_key(query)
    try:
        cached = _redis_client().get(key)
        if cached:
            payload: Any = json.loads(cached)
            if isinstance(payload, list) and len(payload) == _EMBED_DIM:
                return [float(x) for x in payload]
    except (RedisError, json.JSONDecodeError, TypeError, ValueError):
        logger.exception("query_embed_cache_read_failed")

    vec = _embed_live(query)
    try:
        _redis_client().setex(key, _CACHE_TTL_SECONDS, json.dumps(vec))
    except RedisError:
        logger.exception("query_embed_cache_write_failed")
    return vec
