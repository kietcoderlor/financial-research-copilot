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
