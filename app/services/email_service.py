from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_smtp_sync(*, to_email: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        logger.warning("SMTP not configured; skipping email to %s", to_email)
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from or settings.smtp_user or "noreply@financial-copilot.local"
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


async def send_otp_email(email: str, code: str) -> None:
    subject = "Your Financial Research Copilot sign-in code"
    body = (
        f"Your verification code is: {code}\n\n"
        f"This code expires in {settings.auth_otp_ttl_seconds // 60} minutes.\n"
        "If you did not request this, you can ignore this email."
    )
    await asyncio.to_thread(
        _send_smtp_sync,
        to_email=email,
        subject=subject,
        body=body,
    )
