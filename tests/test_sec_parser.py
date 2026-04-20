from app.ingestion.parsers.sec_parser import parse_sec_filing_html


def test_parse_sec_html_extracts_major_items() -> None:
    html = """
    <html><body>
    <div>Table of Contents</div>
    <p>ITEM 1. BUSINESS</p>
    <p>We operate a global business selling widgets.</p>
    <p>ITEM 1A. RISK FACTORS</p>
    <p>Competition could harm results.</p>
    <p>ITEM 7. MANAGEMENT'S DISCUSSION AND ANALYSIS</p>
    <p>Revenue increased year over year.</p>
    <p>ITEM 7A. QUANTITATIVE AND QUALITATIVE DISCLOSURES</p>
    <p>Foreign exchange sensitivity is limited.</p>
    </body></html>
    """
    sections = parse_sec_filing_html(html)
    labels = [s.label for s in sections]
    assert "business" in labels
    assert "risk_factors" in labels
    assert "mda" in labels
    assert "quantitative_disclosures" in labels
    assert all(len(s.text) > 20 for s in sections)


def test_parse_plain_small_html_falls_back_to_full_document() -> None:
    html = "<html><body><p>No item headers here, just prose.</p></body></html>"
    sections = parse_sec_filing_html(html)
    assert len(sections) == 1
    assert sections[0].label == "full_document"
