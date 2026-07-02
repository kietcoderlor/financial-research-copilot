from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ResearchNoteCreate(BaseModel):
    title: str = Field(min_length=3, max_length=256)
    question: str = Field(min_length=3, max_length=2000)
    answer: str = Field(min_length=3, max_length=50_000)
    citations_json: str = Field(default="[]", max_length=200_000)


class ResearchNoteResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    question: str
    answer: str
    citations_json: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

