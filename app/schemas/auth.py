from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class OtpSendRequest(BaseModel):
    email: EmailStr


class OtpSendResponse(BaseModel):
    message: str
    dev_otp: str | None = None


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=10)


class UserPublic(BaseModel):
    id: UUID
    email: str
    name: str | None = None
    image_url: str | None = None
    email_verified: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
