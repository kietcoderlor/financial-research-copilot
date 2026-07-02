from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.models import ResearchNote, User
from app.db.session import get_session
from app.schemas.notes import ResearchNoteCreate, ResearchNoteResponse
from app.core.config import settings
from app.core.rate_limiter import rate_limit_or_raise

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[ResearchNoteResponse])
async def list_notes(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0, le=1000),
) -> list[ResearchNote]:
    client_ip = (request.client.host if request.client else "unknown").strip()
    rate_key = f"rl:notes:list:{current_user.id}:{client_ip}"
    await asyncio.to_thread(
        rate_limit_or_raise,
        key=rate_key,
        limit_per_window=settings.notes_rate_limit_per_minute,
        window_seconds=60,
    )
    result = await session.execute(
        select(ResearchNote)
        .where(ResearchNote.user_id == current_user.id)
        .order_by(ResearchNote.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


@router.post("", response_model=ResearchNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    request: Request,
    body: ResearchNoteCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ResearchNote:
    client_ip = (request.client.host if request.client else "unknown").strip()
    rate_key = f"rl:notes:create:{current_user.id}:{client_ip}"
    await asyncio.to_thread(
        rate_limit_or_raise,
        key=rate_key,
        limit_per_window=settings.notes_rate_limit_per_minute,
        window_seconds=60,
    )
    note = ResearchNote(
        user_id=current_user.id,
        title=body.title.strip()[:256],
        question=body.question.strip(),
        answer=body.answer.strip(),
        citations_json=body.citations_json,
    )
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    request: Request,
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    client_ip = (request.client.host if request.client else "unknown").strip()
    rate_key = f"rl:notes:delete:{current_user.id}:{client_ip}"
    await asyncio.to_thread(
        rate_limit_or_raise,
        key=rate_key,
        limit_per_window=settings.notes_rate_limit_per_minute,
        window_seconds=60,
    )
    result = await session.execute(
        select(ResearchNote).where(
            ResearchNote.id == note_id,
            ResearchNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    await session.delete(note)
    await session.commit()

