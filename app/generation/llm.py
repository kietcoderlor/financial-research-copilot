"""Anthropic LLM integration for grounded answer synthesis."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import anthropic

from app.core.config import settings
from app.core.pricing import compute_llm_cost_usd

logger = logging.getLogger(__name__)
_PROMPT_PATH = Path(__file__).with_name("prompts") / "system_prompt.txt"
_DEFAULT_MODEL = "claude-sonnet-4-5"


@dataclass(slots=True)
class LLMResponse:
    answer_text: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


def _system_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


def _build_user_content(query: str, query_type: str, context_str: str, extra_instruction: str) -> str:
    return (
        f"Query type: {query_type}\n"
        f"Instruction: {extra_instruction}\n\n"
        f"Question:\n{query}\n\n"
        f"Context:\n{context_str}\n"
    )


def _choose_model(*, query_type: str, context_str: str) -> str:
    if query_type in {"comparison", "bull_bear"}:
        return settings.llm_model_strong
    if len(context_str) >= settings.llm_route_context_chars:
        return settings.llm_model_strong
    return settings.llm_model_fast or _DEFAULT_MODEL


def generate_answer_stream(
    *,
    query: str,
    context_str: str,
    query_type: str,
    extra_instruction: str,
) -> Iterator[str]:
    """Yield text deltas from Anthropic streaming API."""
    if not settings.anthropic_api_key:
        yield "I don't have sufficient information in the provided documents."
        return

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    user_content = _build_user_content(query, query_type, context_str, extra_instruction)
    model = _choose_model(query_type=query_type, context_str=context_str)
    with client.messages.stream(
        model=model,
        max_tokens=2048,
        system=_system_prompt(),
        messages=[{"role": "user", "content": user_content}],
    ) as stream:
        for event in stream.text_stream:
            if event:
                yield event


def generate_answer(
    *,
    query: str,
    context_str: str,
    query_type: str,
    extra_instruction: str,
) -> LLMResponse:
    if not settings.anthropic_api_key:
        return LLMResponse(
            answer_text="I don't have sufficient information in the provided documents.",
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.0,
        )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    model = _choose_model(query_type=query_type, context_str=context_str)
    try:
        msg = client.messages.create(
            model=model,
            max_tokens=2048,
            system=_system_prompt(),
            messages=[
                {
                    "role": "user",
                    "content": _build_user_content(query, query_type, context_str, extra_instruction),
                }
            ],
        )
        text = "".join(block.text for block in msg.content if getattr(block, "type", "") == "text").strip()
        usage = getattr(msg, "usage", None)
        in_tokens = int(getattr(usage, "input_tokens", 0))
        out_tokens = int(getattr(usage, "output_tokens", 0))
        cost = compute_llm_cost_usd(model, in_tokens, out_tokens)
        return LLMResponse(
            answer_text=text
            or "I don't have sufficient information in the provided documents.",
            input_tokens=in_tokens,
            output_tokens=out_tokens,
            cost_usd=cost,
        )
    except Exception:
        logger.exception("anthropic_generate_failed")
        return LLMResponse(
            answer_text="I don't have sufficient information in the provided documents.",
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.0,
        )
