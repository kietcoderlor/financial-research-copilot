"""PDF text extraction (P2-6) — shareholder letters and similar."""

from __future__ import annotations

import io
import logging

import pdfplumber

logger = logging.getLogger(__name__)


def parse_pdf_bytes(data: bytes) -> str:
    """Extract plain text; log warnings for empty or unreadable pages (does not raise)."""
    parts: list[str] = []
    bad_pages: list[int] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            try:
                t = page.extract_text()
            except Exception:
                logger.warning("pdf_page_extract_exception page=%s", i)
                bad_pages.append(i)
                continue
            if not t or not t.strip():
                bad_pages.append(i)
                continue
            parts.append(t)
    if bad_pages:
        logger.warning("pdf_pages_unreadable_or_empty pages=%s", bad_pages)
    return "\n\n".join(parts)
