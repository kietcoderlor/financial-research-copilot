from app.ingestion.chunker import chunk_text, count_tokens


def test_chunker_max_tokens_under_600() -> None:
    body = "Word " * 8000
    chunks = chunk_text(body, section="business")
    assert chunks
    assert all(c.token_count <= 600 for c in chunks)


def test_chunker_propagates_section() -> None:
    chunks = chunk_text("Short text.", section="risk_factors")
    assert len(chunks) == 1
    assert chunks[0].section == "risk_factors"


def test_count_tokens_positive() -> None:
    assert count_tokens("hello") > 0
