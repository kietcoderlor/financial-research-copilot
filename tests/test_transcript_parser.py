from app.ingestion.parsers.transcript_parser import parse_transcript_sections


def test_transcript_prepared_and_qa_split() -> None:
    text = (
        "Operator: Welcome.\n\n"
        "CEO: Prepared remarks here about the quarter.\n\n"
        "Analyst: What is gross margin?\n\n"
        "CFO: Margin was stable.\n"
    )
    segs = parse_transcript_sections(text)
    labels = [s[0] for s in segs]
    assert "prepared_remarks" in labels
    assert "qa" in labels


def test_transcript_single_section_when_no_break() -> None:
    text = "Operator: Only prepared content.\n\nCEO: No questions yet.\n"
    segs = parse_transcript_sections(text)
    assert len(segs) == 1
    assert segs[0][0] == "prepared_remarks"
