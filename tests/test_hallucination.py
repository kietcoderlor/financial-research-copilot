"""Hallucination flagger tests."""

from app.generation.hallucination import detect_hallucination_flags


class _Chunk:
    def __init__(self, text: str):
        self.text = text


def test_flags_unsupported_numeric_claim():
    chunks = [_Chunk("Revenue grew modestly with stable margins.")]
    flags = detect_hallucination_flags("Revenue jumped 47% year over year.", chunks, threshold=0.9)
    assert len(flags) >= 1
