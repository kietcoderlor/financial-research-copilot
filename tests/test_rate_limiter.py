from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.rate_limiter import rate_limit_or_raise_with_client


class FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}

    def incr(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, _key: str, _seconds: int) -> bool:
        # Ignore TTL in unit tests.
        return True


def test_rate_limit_allows_until_limit() -> None:
    redis = FakeRedis()
    key = "rl:test:1"
    for _ in range(3):
        attempts = rate_limit_or_raise_with_client(redis, key=key, limit_per_window=3, window_seconds=60)
        assert attempts <= 3


def test_rate_limit_blocks_after_limit() -> None:
    redis = FakeRedis()
    key = "rl:test:2"
    with pytest.raises(HTTPException) as excinfo:
        # 1..3 allowed, 4th blocked
        for _ in range(4):
            rate_limit_or_raise_with_client(redis, key=key, limit_per_window=3, window_seconds=60)

    assert excinfo.value.status_code == 429

