"""SEC filing HTML parser (P2-4) — extract labeled sections from 10-K / 10-Q."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from bs4 import BeautifulSoup
from sec_edgar_downloader import Downloader


@dataclass(frozen=True)
class SecSection:
    """Logical section label + body text (may be large)."""

    label: str
    text: str


def extract_text_from_sec_html(html: str) -> str:
    """Strip tags / scripts; keep line breaks for Item header matching."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text("\n")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# Order matters: first occurrence wins for start positions; we slice in document order.
_ITEM_MARKERS: list[tuple[str, re.Pattern[str]]] = [
    (
        "business",
        re.compile(r"(?is)\bitem\s*1\s*[.\u00B7]?\s*business\b"),
    ),
    (
        "risk_factors",
        re.compile(r"(?is)\bitem\s*1A\s*[.\u00B7]?\s*risk\s*factors\b"),
    ),
    (
        "mda",
        re.compile(
            r"(?is)\bitem\s*7\s*[.\u00B7]?\s*management[’']s\s*discussion\s+and\s+analysis\b"
        ),
    ),
    (
        "quantitative_disclosures",
        re.compile(
            r"(?is)\bitem\s*7A\s*[.\u00B7]?\s*quantitative\s+and\s+qualitative\s+disclosures\b"
        ),
    ),
]


def parse_sec_filing_html(html: str, *, min_chars: int = 25) -> list[SecSection]:
    """Split visible text into major Item sections when headers are present."""
    full = extract_text_from_sec_html(html)
    if not full:
        return []

    hits: list[tuple[int, str]] = []
    for label, pat in _ITEM_MARKERS:
        m = pat.search(full)
        if m:
            hits.append((m.start(), label))

    if len(hits) < 2:
        return [SecSection(label="full_document", text=full)] if full else []

    hits.sort(key=lambda h: h[0])
    sections: list[SecSection] = []
    for i, (start, label) in enumerate(hits):
        end = hits[i + 1][0] if i + 1 < len(hits) else len(full)
        body = full[start:end].strip()
        if len(body) >= min_chars:
            sections.append(SecSection(label=label, text=body))
    return sections


def download_sec_filing_html(
    ticker: str,
    form: str,
    year: int,
    *,
    company_name: str,
    email: str,
) -> str:
    """Download the largest HTML fragment for a filing (network; SEC rate limits apply)."""
    ticker = ticker.upper().strip()
    form = form.upper().strip()
    after = f"{year}-01-01"
    before = f"{year}-12-31"

    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        dl = Downloader(company_name, email, download_folder=root)
        dl.get(form, ticker, limit=1, after=after, before=before, download_details=True)
        candidates = list(root.rglob("*.htm")) + list(root.rglob("*.html"))
        if not candidates:
            raise FileNotFoundError(
                f"No HTML filing found for {ticker} {form} {year} under {root}"
            )
        candidates.sort(key=lambda p: p.stat().st_size, reverse=True)
        return candidates[0].read_text(encoding="utf-8", errors="replace")
