"""Token-based chunking (P2-7) using LangChain + tiktoken."""

from __future__ import annotations

from dataclasses import dataclass

import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter

_splitter: RecursiveCharacterTextSplitter | None = None


@dataclass(frozen=True)
class ChunkRecord:
    text: str
    section: str | None
    token_count: int


def _get_splitter() -> RecursiveCharacterTextSplitter:
    global _splitter
    if _splitter is None:
        _splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            encoding_name="cl100k_base",
            chunk_size=512,
            chunk_overlap=50,
        )
    return _splitter


def count_tokens(text: str) -> int:
    enc = tiktoken.get_encoding("cl100k_base")
    return len(enc.encode(text))


def chunk_text(text: str, section: str | None = None) -> list[ChunkRecord]:
    text = text.strip()
    if not text:
        return []
    splitter = _get_splitter()
    parts = [p for p in splitter.split_text(text) if p.strip()]
    return [ChunkRecord(text=p, section=section, token_count=count_tokens(p)) for p in parts]
