"""Types for retrieval pipeline outputs."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(slots=True)
class ChunkResult:
    id: UUID
    text: str
    company: str
    doc_type: str
    year: int | None
    section: str | None
    score: float


@dataclass(slots=True)
class RetrievalResult:
    chunks: list[ChunkResult]
    latency_breakdown: dict[str, int]
