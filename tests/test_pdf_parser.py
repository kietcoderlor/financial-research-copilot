from unittest.mock import MagicMock, patch

from app.ingestion.parsers.pdf_parser import parse_pdf_bytes


def test_pdf_parser_skips_empty_pages() -> None:
    p1 = MagicMock()
    p1.extract_text.return_value = "Visible text."
    p2 = MagicMock()
    p2.extract_text.return_value = ""
    fake = MagicMock()
    fake.pages = [p1, p2]
    ctx = MagicMock()
    ctx.__enter__.return_value = fake
    ctx.__exit__.return_value = None

    with patch("app.ingestion.parsers.pdf_parser.pdfplumber.open", return_value=ctx):
        text = parse_pdf_bytes(b"%PDF-1.4 dummy")

    assert "Visible text." in text
