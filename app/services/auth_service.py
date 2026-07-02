from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import User


def verify_google_id_token(token: str) -> dict:
    if not settings.google_client_id:
        raise ValueError("Google sign-in is not configured")
    return id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        settings.google_client_id,
    )


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def get_user_by_google_sub(session: AsyncSession, google_sub: str) -> User | None:
    result = await session.execute(select(User).where(User.google_sub == google_sub))
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: UUID) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def upsert_user_from_otp(session: AsyncSession, *, email: str) -> User:
    normalized = email.lower()
    user = await get_user_by_email(session, normalized)
    now = datetime.now(timezone.utc)
    if user is None:
        user = User(email=normalized, email_verified_at=now)
        session.add(user)
    elif user.email_verified_at is None:
        user.email_verified_at = now
    await session.commit()
    await session.refresh(user)
    return user


async def upsert_user_from_google(session: AsyncSession, *, claims: dict) -> User:
    google_sub = str(claims["sub"])
    email = str(claims.get("email", "")).lower()
    if not email:
        raise ValueError("Google account has no email")

    user = await get_user_by_google_sub(session, google_sub)
    if user is None:
        user = await get_user_by_email(session, email)

    now = datetime.now(timezone.utc)
    name = claims.get("name")
    picture = claims.get("picture")

    if user is None:
        user = User(
            email=email,
            name=name,
            image_url=picture,
            google_sub=google_sub,
            email_verified_at=now,
        )
        session.add(user)
    else:
        user.google_sub = google_sub
        user.name = name or user.name
        user.image_url = picture or user.image_url
        if claims.get("email_verified") and user.email_verified_at is None:
            user.email_verified_at = now

    await session.commit()
    await session.refresh(user)
    return user
