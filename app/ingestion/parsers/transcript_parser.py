"""Earnings call transcript parsing (P2-5)."""

from __future__ import annotations

import re


def parse_transcript_sections(text: str) -> list[tuple[str, str]]:
    """
    Split transcript into `prepared_remarks` vs `qa` blocks (coarse split).

    Heuristic: first Analyst / Q&A style breakpoint starts the Q&A section.
    """
    text = text.strip()
    if not text:
        return []
    m = re.search(
        r"(?is)(?:^|\n)\s*(?:analyst|investor)\s*[:.)]|\bquestion\s+and\s+answer\b|\bQ\s*&\s*A\b",
        text,
    )
    if not m:
        return [("prepared_remarks", text)]
    head = text[: m.start()].strip()
    tail = text[m.start() :].strip()
    out: list[tuple[str, str]] = []
    if head:
        out.append(("prepared_remarks", head))
    if tail:
        out.append(("qa", tail))
    return out if out else [("prepared_remarks", text)]
