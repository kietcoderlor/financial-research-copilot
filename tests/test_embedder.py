import app.ingestion.embedder as embedder_mod


def test_embedder_stub_shape_without_api_key(monkeypatch) -> None:
    monkeypatch.setattr(embedder_mod.settings, "openai_api_key", None)
    out = embedder_mod.embed_texts([f"line {i}" for i in range(10)])
    assert len(out) == 10
    assert all(len(v) == 1536 for v in out)
