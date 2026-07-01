#!/usr/bin/env python3
"""LLM-as-judge helpers (P7-B5)."""

from __future__ import annotations

import json
import os
from typing import Any

import anthropic

JUDGE_MODEL = os.environ.get("JUDGE_MODEL", "claude-3-5-haiku-20241022")


def _client() -> anthropic.Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY required for LLM judge")
    return anthropic.Anthropic(api_key=key)


def judge_retrieval(query: str, chunks: list[dict[str, Any]]) -> list[int]:
    if not chunks:
        return [0, 0, 0, 0, 0]
    payload = [{"rank": i + 1, "company": c.get("company"), "text": (c.get("text") or "")[:500]} for i, c in enumerate(chunks[:5])]
    prompt = (
        "Score each chunk 1 if relevant to answering the query else 0. "
        "Return JSON array of five integers.\n"
        f"Query: {query}\nChunks: {json.dumps(payload)}"
    )
    msg = _client().messages.create(model=JUDGE_MODEL, max_tokens=128, messages=[{"role": "user", "content": prompt}])
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    try:
        scores = json.loads(text.strip())
        return [int(x) for x in scores][:5]
    except (json.JSONDecodeError, ValueError, TypeError):
        return [0] * 5


def judge_generation(query: str, answer: str, chunks: list[dict[str, Any]]) -> dict[str, float]:
    prompt = (
        "Rate faithfulness completeness clarity from 1-5 as JSON object.\n"
        f"Query: {query}\nAnswer: {answer}\nContext chunks: {json.dumps(chunks[:3])}"
    )
    msg = _client().messages.create(model=JUDGE_MODEL, max_tokens=128, messages=[{"role": "user", "content": prompt}])
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    try:
        data = json.loads(text.strip())
        return {k: float(data.get(k, 3)) for k in ("faithfulness", "completeness", "clarity")}
    except (json.JSONDecodeError, ValueError, TypeError):
        return {"faithfulness": 3.0, "completeness": 3.0, "clarity": 3.0}
