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


class QueryCitationResponse(BaseModel):
    index: int
    chunk_id: UUID
    company: str
    doc_type: str
    year: int | None
    section: str | None
    source_url: str | None
    excerpt: str


class QueryMetadataResponse(BaseModel):
    query_type: str
    chunks_retrieved: int
    chunks_used: int
    retrieval_ms: int
    llm_ms: int
    input_tokens: int
    output_tokens: int
    llm_cost_usd: float = 0.0
    total_ms: int
    cache_hit: bool = False


class QueryResponse(BaseModel):
    answer: str
    citations: list[QueryCitationResponse]
    metadata: QueryMetadataResponse
