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


def sanitize_answer_citations(answer_text: str, max_index: int) -> str:
    """Drop invalid citation indices from answer text.

    Example:
      "[1, 7]" with max_index=5 -> "[1]"
      "[9]" with max_index=5 -> ""
    """
    if max_index <= 0 or not answer_text:
        return answer_text

    def _repl(match: re.Match[str]) -> str:
        raw = match.group(1)
        kept: list[str] = []
        for part in raw.split(","):
            v = part.strip()
            if v.isdigit():
                idx = int(v)
                if 1 <= idx <= max_index:
                    kept.append(str(idx))
        if not kept:
            return ""
        # preserve order while removing duplicates
        uniq: list[str] = []
        seen: set[str] = set()
        for k in kept:
            if k not in seen:
                seen.add(k)
                uniq.append(k)
        return "[" + ", ".join(uniq) + "]"

    cleaned = _CIT_RE.sub(_repl, answer_text)
    # compact orphaned spaces left by removed citations
    cleaned = re.sub(r"\s{2,}", " ", cleaned).replace(" .", ".").replace(" ,", ",")
    return cleaned.strip()
