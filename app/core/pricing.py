"""LLM pricing helpers (P7-C3)."""

from __future__ import annotations

# USD per 1M tokens — update when provider pricing changes.
MODEL_RATES: dict[str, tuple[float, float]] = {
    "claude-sonnet-4-5": (3.0, 15.0),
    "claude-3-5-haiku-20241022": (0.8, 4.0),
    "claude-3-haiku-20240307": (0.25, 1.25),
}


def compute_llm_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = MODEL_RATES.get(model, (3.0, 15.0))
    return (input_tokens / 1_000_000) * in_rate + (output_tokens / 1_000_000) * out_rate
