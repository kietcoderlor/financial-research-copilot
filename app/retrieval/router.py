"""Query router / classifier (P7-B1)."""

from __future__ import annotations

import hashlib
import json
import logging
import re

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)
_ROUTE_TYPES = ("factual", "comparison", "synthesis", "adversarial", "bull_bear")


def _cache_client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def _cache_key(question: str) -> str:
    norm = re.sub(r"\s+", " ", question.strip().lower())
    h = hashlib.sha256(norm.encode("utf-8")).hexdigest()
    return f"route:{h}"


def _rule_classify(question: str) -> str | None:
    q = question.lower()
    if any(k in q for k in ("compare", " vs ", " versus ", "difference between")):
        return "comparison"
    if any(k in q for k in ("bull case", "bear case", "bullish", "bearish")):
        return "bull_bear"
    if any(
        k in q
        for k in (
            "not in corpus",
            "fictional",
            "year 2099",
            "private company xyz",
            "what will happen tomorrow",
        )
    ):
        return "adversarial"
    if any(k in q for k in ("summarize", "synthesis", "overall", "key themes", "outlook")):
        return "synthesis"
    if re.search(r"\b(what|how|when|where|which)\b", q):
        return "factual"
    return None


def _haiku_classify(question: str) -> str:
    if not settings.anthropic_api_key:
        return "factual"
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=32,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Classify this financial research query into exactly one label: "
                        "factual, comparison, synthesis, adversarial, bull_bear.\n"
                        f"Query: {question}\nLabel:"
                    ),
                }
            ],
        )
        label = "".join(
            block.text for block in msg.content if getattr(block, "type", "") == "text"
        ).strip().lower()
        for rt in _ROUTE_TYPES:
            if rt in label:
                return rt
    except Exception:
        logger.exception("router_haiku_failed")
    return "factual"


def route_query(question: str) -> str:
    cached = None
    key = _cache_key(question)
    try:
        cached = _cache_client().get(key)
    except RedisError:
        pass
    if cached in _ROUTE_TYPES:
        logger.info("router_cache event=hit route=%s", cached)
        return cached

    routed = _rule_classify(question) or _haiku_classify(question)
    if routed not in _ROUTE_TYPES:
        routed = "factual"
    try:
        _cache_client().setex(key, 3600, routed)
    except RedisError:
        pass
    logger.info("router_decision route=%s", routed)
    return routed


def extract_comparison_entities(question: str) -> list[str]:
    """Best-effort ticker extraction for multi-hop retrieval."""
    ticker_map = {
        "apple": "AAPL",
        "aapl": "AAPL",
        "microsoft": "MSFT",
        "msft": "MSFT",
        "tesla": "TSLA",
        "tsla": "TSLA",
        "google": "GOOGL",
        "alphabet": "GOOGL",
        "googl": "GOOGL",
        "berkshire": "BRK.B",
        "brk": "BRK.B",
        "jpmorgan": "JPM",
        "goldman": "GS",
        "gs": "GS",
        "exxon": "XOM",
        "walmart": "WMT",
        "unitedhealth": "UNH",
    }
    q = question.lower()
    found: list[str] = []
    for token, ticker in ticker_map.items():
        if re.search(rf"\b{re.escape(token)}\b", q) and ticker not in found:
            found.append(ticker)
    return found[:4]
