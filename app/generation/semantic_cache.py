"""Semantic query cache fallback (P7-B7)."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from sqlalchemy import text

from app.core.config import settings
from app.retrieval.db import get_sync_engine
from app.retrieval.query_embedder import embed_query

logger = logging.getLogger(__name__)


def _filters_hash(filters: dict[str, Any]) -> str:
    payload = json.dumps(filters, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get_semantic_cached(question: str, filters: dict[str, Any]) -> dict[str, Any] | None:
    try:
        vec = embed_query(question)
        fhash = _filters_hash(filters)
        literal = "[" + ",".join(f"{x:.8f}" for x in vec) + "]"
        sql = text(
            """
            SELECT response_json
            FROM cached_query_responses
            WHERE filters_hash = :fhash
              AND (1 - (query_embedding <=> CAST(:qvec AS vector))) >= :threshold
            ORDER BY query_embedding <=> CAST(:qvec AS vector)
            LIMIT 1
            """
        )
        with get_sync_engine().connect() as conn:
            row = conn.execute(
                sql,
                {
                    "qvec": literal,
                    "fhash": fhash,
                    "threshold": settings.semantic_cache_threshold,
                },
            ).first()
        if row and row[0]:
            logger.info("semantic_cache event=hit")
            return json.loads(row[0])
    except Exception:
        logger.exception("semantic_cache_lookup_failed")
    return None


def put_semantic_cached(question: str, filters: dict[str, Any], response: dict[str, Any]) -> None:
    try:
        vec = embed_query(question)
        fhash = _filters_hash(filters)
        literal = "[" + ",".join(f"{x:.8f}" for x in vec) + "]"
        sql = text(
            """
            INSERT INTO cached_query_responses (query_text, query_embedding, filters_hash, response_json)
            VALUES (:qtext, CAST(:qvec AS vector), :fhash, CAST(:resp AS jsonb))
            """
        )
        with get_sync_engine().begin() as conn:
            conn.execute(
                sql,
                {
                    "qtext": question,
                    "qvec": literal,
                    "fhash": fhash,
                    "resp": json.dumps(response, ensure_ascii=True),
                },
            )
        logger.info("semantic_cache event=store")
    except Exception:
        logger.exception("semantic_cache_store_failed")
