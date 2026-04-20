"""Vector similarity search over pgvector embeddings."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import text

from app.models.requests import RetrieveFilters
from app.retrieval.db import get_sync_engine
from app.retrieval.types import ChunkResult


def _vector_literal(query_vec: list[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in query_vec) + "]"


def search_vector(
    query_vec: list[float],
    filters: RetrieveFilters,
    *,
    limit: int = 20,
) -> list[ChunkResult]:
    where = ["embedding IS NOT NULL"]
    params: dict[str, object] = {"qvec": _vector_literal(query_vec), "limit": int(limit)}
    if filters.companies:
        where.append("company_ticker = ANY(:companies)")
        params["companies"] = filters.companies
    if filters.years:
        where.append("year = ANY(:years)")
        params["years"] = filters.years
    if filters.doc_types:
        where.append("doc_type = ANY(:doc_types)")
        params["doc_types"] = filters.doc_types

    sql = text(
        f"""
        SELECT
          id::text AS id,
          chunk_text,
          company_ticker,
          doc_type,
          year,
          section,
          (1 - (embedding <=> CAST(:qvec AS vector)))::float AS score
        FROM document_chunks
        WHERE {" AND ".join(where)}
        ORDER BY embedding <=> CAST(:qvec AS vector)
        LIMIT :limit
        """
    )
    with get_sync_engine().connect() as conn:
        rows = conn.execute(sql, params).mappings().all()
    return [
        ChunkResult(
            id=UUID(r["id"]),
            text=r["chunk_text"],
            company=r["company_ticker"],
            doc_type=r["doc_type"],
            year=r["year"],
            section=r["section"],
            score=float(r["score"] or 0.0),
        )
        for r in rows
    ]
