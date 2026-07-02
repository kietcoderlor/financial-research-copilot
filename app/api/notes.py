from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.models import ResearchNote, User
from app.db.session import get_session
from app.schemas.notes import ResearchNoteCreate, ResearchNoteResponse

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[ResearchNoteResponse])
async def list_notes(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ResearchNote]:
    result = await session.execute(
        select(ResearchNote)
        .where(ResearchNote.user_id == current_user.id)
        .order_by(ResearchNote.updated_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=ResearchNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    body: ResearchNoteCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ResearchNote:
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
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
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

