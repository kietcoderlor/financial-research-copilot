"""Build retrieval context string for LLM prompts."""

from __future__ import annotations

import tiktoken

from app.retrieval.types import ChunkResult

_ENC = tiktoken.get_encoding("cl100k_base")
_MAX_CONTEXT_TOKENS = 150_000


def _fmt_block(idx: int, chunk: ChunkResult) -> str:
    header = (
        f"[{idx}] Company: {chunk.company} | Source: {chunk.doc_type} "
        f"{chunk.year if chunk.year is not None else 'NA'} | Section: {chunk.section or 'unknown'}"
    )
    return f"{header}\n{chunk.text.strip()}"


def build_context(chunks: list[ChunkResult]) -> tuple[str, list[ChunkResult]]:
    blocks: list[str] = []
    kept: list[ChunkResult] = []
    token_total = 0

    for idx, chunk in enumerate(chunks, start=1):
        block = _fmt_block(idx, chunk)
        block_tokens = len(_ENC.encode(block))
        if token_total + block_tokens > _MAX_CONTEXT_TOKENS:
            break
        blocks.append(block)
        kept.append(chunk)
        token_total += block_tokens

    return "\n\n".join(blocks), kept
