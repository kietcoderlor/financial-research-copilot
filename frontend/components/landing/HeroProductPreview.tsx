const SOURCES = [
  {
    index: 1,
    ticker: "NVDA",
    docType: "10-Q",
    period: "FY2025 Q2",
    filed: "Aug 28, 2024",
    excerpt:
      "Data center revenue was $26.3 billion, up 154% from a year ago, driven by demand for the NVIDIA Hopper GPU computing platform used for training and inference of large language models.",
  },
  {
    index: 2,
    ticker: "NVDA",
    docType: "Transcript",
    period: "Q2 FY2025",
    filed: "Aug 28, 2024",
    excerpt:
      "Management highlighted accelerated computing demand from cloud service providers and consumer internet companies deploying generative AI workloads at scale.",
  },
  {
    index: 3,
    ticker: "MSFT",
    docType: "10-K",
    period: "FY2024",
    filed: "Jul 30, 2024",
    excerpt:
      "Intelligent Cloud revenue grew 20%, with Azure and other cloud services up 30%, reflecting continued enterprise adoption of AI infrastructure.",
  },
] as const;

const FILTER_CHIPS = ["AAPL", "MSFT", "NVDA"] as const;
const DOC_CHIPS = ["10-K", "10-Q", "8-K"] as const;

export function HeroProductPreview() {
  return (
    <div className="product-preview" role="region" aria-label="Example research workspace preview">
      <div className="product-preview-toolbar">
        <span className="product-preview-toolbar-label">Workspace</span>
        <div className="product-preview-filters">
          {FILTER_CHIPS.map((ticker) => (
            <span key={ticker} className="product-preview-chip">
              {ticker}
            </span>
          ))}
          {DOC_CHIPS.map((doc) => (
            <span key={doc} className="product-preview-chip product-preview-chip-muted">
              {doc}
            </span>
          ))}
        </div>
      </div>

      <div className="product-preview-query">
        <svg className="product-preview-query-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
        </svg>
        <p className="product-preview-query-text">
          How did NVIDIA describe data center revenue growth in the latest 10-Q?
        </p>
      </div>

      <div className="product-preview-answer">
        <p className="product-preview-answer-label">Answer</p>
        <p className="product-preview-answer-body">
          Data center revenue increased primarily due to demand for accelerated computing and generative AI workloads,
          with management citing higher shipments of NVIDIA Hopper GPU architecture products
          <CitationMark n={1} />
          <CitationMark n={2} />
          .
        </p>
      </div>

      <div className="product-preview-sources">
        <p className="product-preview-sources-label">Sources</p>
        <ul className="product-preview-source-list">
          {SOURCES.map((source) => (
            <li key={source.index} className="product-preview-source-card">
              <div className="product-preview-source-head">
                <span className="product-preview-citation-index">{source.index}</span>
                <span className="product-preview-source-ticker">{source.ticker}</span>
                <span className="product-preview-source-doc">{source.docType}</span>
                <span className="product-preview-source-meta">{source.period}</span>
                <span className="product-preview-source-date">{source.filed}</span>
              </div>
              <p className="product-preview-source-excerpt">{source.excerpt}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CitationMark({ n }: { n: number }) {
  return (
    <span className="product-preview-inline-cite" title={`Source ${n}`}>
      {n}
    </span>
  );
}
