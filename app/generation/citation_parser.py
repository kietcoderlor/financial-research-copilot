"""Citation extraction and validation for generated answers."""

from __future__ import annotations

import logging
import re

from app.retrieval.types import ChunkResult

logger = logging.getLogger(__name__)
_CIT_RE = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")


def extract_citation_indices(answer_text: str) -> list[int]:
    out: list[int] = []
    for group in _CIT_RE.findall(answer_text):
        for part in group.split(","):
            v = part.strip()
            if v.isdigit():
                out.append(int(v))
    # preserve order, de-dup
    seen: set[int] = set()
    uniq: list[int] = []
    for i in out:
        if i not in seen:
            seen.add(i)
            uniq.append(i)
    return uniq


def resolve_citations(indices: list[int], chunks: list[ChunkResult]) -> list[tuple[int, ChunkResult]]:
    resolved: list[tuple[int, ChunkResult]] = []
    for idx in indices:
        if 1 <= idx <= len(chunks):
            resolved.append((idx, chunks[idx - 1]))
        else:
            logger.warning("hallucinated_citation index=%s max=%s", idx, len(chunks))
    return resolved
