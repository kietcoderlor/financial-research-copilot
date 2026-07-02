"""Streaming query endpoint via SSE (P7-B2)."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.query import (
    _INSUFFICIENT,
    _context_sufficient,
    _fetch_source_urls,
    _ms,
    _validate_companies,
)
from app.api.auth import require_query_auth
from app.core.config import settings
from app.db.models import User
from app.db.session import get_session
from app.generation.citation_parser import extract_citation_indices, resolve_citations
from app.generation.classifier import query_type_instructions
from app.generation.context_builder import build_context
from app.generation.llm import generate_answer_stream
from app.models.requests import QueryRequest, RetrieveFilters
from app.retrieval.pipeline import retrieve
from app.retrieval.router import route_query
from app.core.rate_limiter import rate_limit_or_raise

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/query", tags=["query"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=True)}\n\n"


@router.post("/stream")
async def post_query_stream(
    body: QueryRequest,
    session: AsyncSession = Depends(get_session),
    _user: User | None = Depends(require_query_auth),
    request: Request,
) -> StreamingResponse:
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question must be non-empty")

    filters: RetrieveFilters = body.filters
    client_ip = (request.client.host if request.client else "unknown").strip()  # type: ignore[union-attr]
    user_key = str(_user.id) if _user else f"ip:{client_ip}"
    rate_key = f"rl:query_stream:{user_key}"
    await asyncio.to_thread(
        rate_limit_or_raise,
        key=rate_key,
        limit_per_window=settings.query_rate_limit_per_minute,
        window_seconds=60,
    )
    await _validate_companies(filters, session)

    async def event_gen() -> AsyncIterator[str]:
        t_total = time.perf_counter()
        t_retr = time.perf_counter()
        query_type = route_query(question)
        if query_type == "adversarial":
            yield _sse("token", {"text": _INSUFFICIENT})
            yield _sse("done", {"total_ms": _ms(t_total), "query_type": query_type})
            logger.info("query_stream event=adversarial total_ms=%s", _ms(t_total))
            return

        retrieval = await asyncio.to_thread(retrieve, question, filters, top_k=20, top_n=5)
        retrieval_ms = _ms(t_retr)
        ctx, kept_chunks = build_context(retrieval.chunks)
        for i, ch in enumerate(kept_chunks[:5], start=1):
            yield _sse(
                "source",
                {
                    "index": i,
                    "company": ch.company,
                    "doc_type": ch.doc_type,
                    "year": ch.year,
                    "section": ch.section,
                },
            )

        if not _context_sufficient(question, kept_chunks) or not settings.anthropic_api_key:
            text = _INSUFFICIENT if not kept_chunks else f"Retrieved {len(kept_chunks)} chunks."
            yield _sse("token", {"text": text})
            yield _sse("done", {"total_ms": _ms(t_total), "query_type": query_type})
            logger.info(
                "query_stream event=short_circuit query_type=%s chunks_used=%s retrieval_ms=%s total_ms=%s",
                query_type,
                len(kept_chunks),
                retrieval_ms,
                _ms(t_total),
            )
            return

        extra = query_type_instructions(query_type)
        t_gen = time.perf_counter()
        full_text = ""
        for token in generate_answer_stream(
            query=question,
            context_str=ctx,
            query_type=query_type,
            extra_instruction=extra,
        ):
            full_text += token
            yield _sse("token", {"text": token})

        indices = extract_citation_indices(full_text)
        resolved = resolve_citations(indices, kept_chunks)
        source_map = await _fetch_source_urls(session, [c.id for _, c in resolved])
        citations = [
            {
                "index": i,
                "chunk_id": str(c.id),
                "company": c.company,
                "doc_type": c.doc_type,
                "year": c.year,
                "section": c.section,
                "source_url": source_map.get(c.id),
                "excerpt": (c.text[:400] + "...") if len(c.text) > 400 else c.text,
            }
            for i, c in resolved
        ]
        total_ms = _ms(t_total)
        generation_ms = _ms(t_gen)
        yield _sse("done", {"total_ms": total_ms, "query_type": query_type, "citations": citations})
        logger.info(
            "query_stream event=complete query_type=%s chunks_used=%s citations=%s retrieval_ms=%s generation_ms=%s total_ms=%s chars=%s",
            query_type,
            len(kept_chunks),
            len(citations),
            retrieval_ms,
            generation_ms,
            total_ms,
            len(full_text),
        )

    return StreamingResponse(event_gen(), media_type="text/event-stream")
