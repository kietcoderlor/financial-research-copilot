from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, status
from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)


def _redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def rate_limit_or_raise_with_client(
    redis_client: Any,
    *,
    key: str,
    limit_per_window: int,
    window_seconds: int,
) -> int:
    """
    Low-level rate limiter: INCR + EXPIRE in Redis.
    Raises 429 when the request budget is exhausted.
    """
    if limit_per_window <= 0:
        return 0

    try:
        attempts = int(redis_client.incr(key))
        if attempts == 1:
            redis_client.expire(key, window_seconds)
        if attempts > limit_per_window:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down and try again.",
            )
        return attempts
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.exception("rate_limiter incr failed key=%s", key)
        raise exc


def rate_limit_or_raise(
    *,
    key: str,
    limit_per_window: int,
    window_seconds: int = 60,
) -> int:
    """
    Production wrapper: uses Redis and fails open if Redis is unavailable.
    """
    try:
        client = _redis()
        return rate_limit_or_raise_with_client(
            client,
            key=key,
            limit_per_window=limit_per_window,
            window_seconds=window_seconds,
        )
    except RedisError:
        # Fail-open: keep the system responsive even if Redis is down.
        logger.warning("rate_limiter redis unavailable; failing open key=%s", key)
        return 0

