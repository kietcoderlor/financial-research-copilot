from uuid import UUID

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(examples=["ok"])
    version: str = Field(examples=["0.1.0"])


class IngestQueuedResponse(BaseModel):
    document_id: UUID
    status: str = Field(examples=["queued"])


class IngestStatusResponse(BaseModel):
    document_id: UUID
    status: str
    chunk_count: int


class RetrieveChunkResponse(BaseModel):
    id: UUID
    text: str
    company: str
    doc_type: str
    year: int | None
    section: str | None
    score: float


class RetrieveLatencyResponse(BaseModel):
    embed_ms: int
    vector_ms: int
    bm25_ms: int
    rerank_ms: int
    total_ms: int


class RetrieveResponse(BaseModel):
    chunks: list[RetrieveChunkResponse]
    latency: RetrieveLatencyResponse
