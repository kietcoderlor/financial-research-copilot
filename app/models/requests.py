"""Pydantic request bodies."""

from pydantic import BaseModel, Field


class IngestCreateRequest(BaseModel):
    s3_key: str = Field(min_length=1)
    company_ticker: str = Field(min_length=1, max_length=16)
    company_name: str | None = Field(default=None, max_length=256)
    doc_type: str = Field(min_length=1, max_length=64)
    year: int | None = Field(default=None, ge=1900, le=2100)
    quarter: int | None = Field(default=None, ge=1, le=4)
    source_url: str | None = None
