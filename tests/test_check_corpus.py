import importlib.util
from pathlib import Path


def _load_check_corpus():
    path = Path(__file__).resolve().parent.parent / "scripts" / "check_corpus.py"
    spec = importlib.util.spec_from_file_location("check_corpus_script", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_derive_dlq_url_from_ingestion_queue() -> None:
    m = _load_check_corpus()
    assert (
        m.derive_dlq_url("http://localhost:9324/000000000000/ingestion-queue")
        == "http://localhost:9324/000000000000/ingestion-dlq"
    )
    assert (
        m.derive_dlq_url("https://sqs.us-east-1.amazonaws.com/123456789/ingestion-queue")
        == "https://sqs.us-east-1.amazonaws.com/123456789/ingestion-dlq"
    )
    assert m.derive_dlq_url("http://x/y/other-queue") is None


def test_sync_db_url_strips_asyncpg() -> None:
    m = _load_check_corpus()
    assert m._sync_db_url("postgresql+asyncpg://u:p@h:5432/db") == "postgresql://u:p@h:5432/db"
    assert m._sync_db_url("postgresql://u:p@h:5432/db") == "postgresql://u:p@h:5432/db"
