from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, decode_access_token
from app.db.models import User
from app.db.session import get_session
from app.schemas.auth import (
    AuthResponse,
    GoogleAuthRequest,
    OtpSendRequest,
    OtpSendResponse,
    OtpVerifyRequest,
    UserPublic,
)
from app.services import auth_service
from app.services.email_service import send_otp_email
from app.services.otp_service import generate_otp_code, store_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        image_url=user.image_url,
        email_verified=user.email_verified_at is not None,
        created_at=user.created_at,
    )


def _auth_response(user: User) -> AuthResponse:
    token = create_access_token(user_id=user.id, email=user.email)
    return AuthResponse(access_token=token, user=_user_public(user))


async def get_current_user(
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        user_id = UUID(str(payload["sub"]))
    except (ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token") from None

    user = await auth_service.get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/otp/send", response_model=OtpSendResponse)
async def send_otp(body: OtpSendRequest) -> OtpSendResponse:
    code = generate_otp_code()
    try:
        store_otp(body.email, code)
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    from app.core.config import settings

    dev_otp: str | None = None
    if settings.auth_otp_dev_expose:
        dev_otp = code
    else:
        await send_otp_email(body.email, code)

    return OtpSendResponse(
        message="Verification code sent to your email.",
        dev_otp=dev_otp,
    )


@router.post("/otp/verify", response_model=AuthResponse)
async def verify_otp_login(
    body: OtpVerifyRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    try:
        ok = verify_otp(body.email, body.code)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user = await auth_service.upsert_user_from_otp(session, email=body.email)
    return _auth_response(user)


@router.post("/google", response_model=AuthResponse)
async def google_login(
    body: GoogleAuthRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    try:
        claims = auth_service.verify_google_id_token(body.id_token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user = await auth_service.upsert_user_from_google(session, claims=claims)
    return _auth_response(user)


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)) -> UserPublic:
    return _user_public(user)
