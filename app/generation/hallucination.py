"""Post-generation hallucination heuristics (P7-B4)."""

from __future__ import annotations

import re
from typing import Any


def _numeric_claims(text: str) -> list[str]:
    return re.findall(r"\b\d+(?:\.\d+)?%?\b", text)


def detect_hallucination_flags(answer: str, cited_chunks: list[Any], *, threshold: float = 0.72) -> list[str]:
    """Flag sentences with numeric claims that lack lexical overlap with cited chunks."""
    if not answer or not cited_chunks:
        return []
    cited_text = " ".join(getattr(c, "text", "") for c in cited_chunks).lower()
    flags: list[str] = []
    for sentence in re.split(r"(?<=[.!?])\s+", answer):
        nums = _numeric_claims(sentence)
        if not nums:
            continue
        tokens = {t.lower() for t in re.findall(r"[A-Za-z]{4,}", sentence)}
        cited_tokens = {t.lower() for t in re.findall(r"[A-Za-z]{4,}", cited_text)}
        if not tokens:
            continue
        overlap = len(tokens & cited_tokens) / max(1, len(tokens))
        if overlap < threshold:
            flags.append(sentence.strip()[:160])
    return flags
