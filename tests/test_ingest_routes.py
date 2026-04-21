from app.main import create_app


def test_openapi_exposes_ingest_paths() -> None:
    app = create_app()
    paths = app.openapi()["paths"]
    assert "/ingest" in paths
    assert "post" in paths["/ingest"]
    assert "/ingest/{document_id}" in paths
    assert "get" in paths["/ingest/{document_id}"]
    assert "/retrieve" in paths
    assert "post" in paths["/retrieve"]
    assert "/query" in paths
    assert "post" in paths["/query"]
