from __future__ import annotations

import secrets

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

_OTP_PREFIX = "auth:otp:"
_RATE_PREFIX = "auth:otp_rate:"


def _redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def _otp_key(email: str) -> str:
    return f"{_OTP_PREFIX}{email.lower()}"


def _rate_key(email: str) -> str:
    return f"{_RATE_PREFIX}{email.lower()}"


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def store_otp(email: str, code: str) -> None:
    client = _redis()
    try:
        rate_key = _rate_key(email)
        attempts = client.incr(rate_key)
        if attempts == 1:
            client.expire(rate_key, 3600)
        if attempts > settings.auth_otp_rate_limit_per_hour:
            raise ValueError("Too many OTP requests. Try again in an hour.")

        client.setex(_otp_key(email), settings.auth_otp_ttl_seconds, code)
    except RedisError as exc:
        raise RuntimeError("OTP service unavailable") from exc


def verify_otp(email: str, code: str) -> bool:
    client = _redis()
    try:
        stored = client.get(_otp_key(email))
        if not stored or stored != code:
            return False
        client.delete(_otp_key(email))
        return True
    except RedisError as exc:
        raise RuntimeError("OTP service unavailable") from exc
