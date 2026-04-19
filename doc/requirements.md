# Financial Research Copilot – Requirements

**Document type:** Feature requirements / product spec  
**Scope:** V1 — portfolio project, production-oriented, solo dev  
**Last updated:** April 2026

---

## 1. Core Idea

Financial Research Copilot is a RAG system that answers financial research questions by retrieving relevant chunks from a corpus of financial documents and generating grounded, citation-backed answers using an LLM.

The system is not a general-purpose chatbot. It is purpose-built for a specific use case: helping users analyze SEC filings, earnings call transcripts, and shareholder letters with precise, source-grounded responses.

---

## 2. Use Cases

### UC-1: Single-company analysis
A user selects a company and asks a factual question about their financial documents.

*Example: "What are Tesla's key risk factors in their 2024 10-K?"*

The system returns a grounded answer citing specific sections from the 10-K filing.

### UC-2: Multi-company comparison
A user asks a question that requires comparing two companies across their documents.

*Example: "Compare Apple and Microsoft's revenue growth guidance in Q3 2024."*

The system retrieves relevant chunks from both companies and synthesizes a comparative answer with citations from each.

### UC-3: Bull/bear case generation
A user asks for a structured investment perspective.

*Example: "What is the bull case vs bear case for NVIDIA based on recent filings?"*

The system generates a structured response with supporting evidence from retrieved chunks.

### UC-4: Adversarial / out-of-corpus query
A user asks about a company not in the corpus, a future event, or a topic with no relevant retrieved chunks.

The system responds with "I don't have sufficient information in my knowledge base" rather than hallucinating.

---

## 3. System Capabilities

| Capability | V1 Status |
|-----------|----------|
| Ingest SEC 10-K filings | In scope |
| Ingest earnings call transcripts | In scope |
| Ingest shareholder letters (PDF) | In scope |
| Hybrid retrieval (BM25 + vector) | In scope |
| Metadata filtering (company, year, doc type) | In scope |
| Cohere reranking | In scope |
| Citation-grounded LLM generation | In scope |
| Redis query cache | In scope |
| Next.js demo UI with filter panel | In scope |
| Deployed on AWS ECS/Fargate | In scope |
| Evaluation benchmark (30–50 Qs) | In scope |
| Multi-turn conversation history | Out of scope (V2) |
| User authentication / accounts | Out of scope (V2) |
| Streaming SSE responses | Out of scope (V2) |
| Macro / market news ingestion | Out of scope (V2) |
| OCR pipeline for scanned PDFs | Out of scope (V2) |
| Custom fine-tuned embeddings | Out of scope (V3) |
| Multi-region deployment | Out of scope (V2) |

---

## 4. V1 In-Scope Features

### 4.1 Document Ingestion

The system ingests documents via an async pipeline triggered by a REST endpoint. Three document types are supported in V1:

- **SEC filings (10-K, 10-Q):** Downloaded via the EDGAR API or `sec-edgar-downloader`. Parsed from HTML using `beautifulsoup4`. Sections labeled: `risk_factors`, `mda`, `business`, `quantitative_disclosures`.
- **Earnings call transcripts:** Sourced from Kaggle dataset or static HTML. Speaker turns parsed. Sections labeled: `prepared_remarks`, `qa`.
- **Shareholder letters (PDF):** Parsed using `pdfplumber`. Text extracted and cleaned.

Each chunk stores: `company_ticker`, `company_name`, `doc_type`, `year`, `quarter`, `section`, `source_url`, `chunk_index`, `token_count`, `embedding`.

### 4.2 Retrieval

The retrieval pipeline runs on every query:

1. Query is embedded using `text-embedding-3-small`.
2. Vector search runs against `pgvector` using cosine distance, filtered by metadata.
3. BM25 full-text search runs against the `tsvector` column with the same metadata filters.
4. Results are fused using Reciprocal Rank Fusion (RRF, k=60).
5. Merged top-20 candidates are reranked by Cohere Rerank v3.5.
6. Top-5 chunks are returned with metadata and scores.

### 4.3 Generation

The LLM (Anthropic Claude 3.5 Sonnet) receives:

- A system prompt instructing it to answer only from provided context and cite every factual claim with `[N]`.
- Numbered context blocks for each of the top-5 chunks.
- The user query and a query-type classification (single_company, comparison, bull_bear, general).

The response is a structured JSON: `{answer, citations: [{index, chunk_id, company, doc_type, year, section, source_url, excerpt}], metadata}`.

### 4.4 Caching

Identical queries (same question + same filters) are served from Redis with a 24-hour TTL. Cache hits return a `metadata.cache_hit: true` flag and respond in under 50ms.

### 4.5 Frontend

A Next.js 14 (App Router) + Tailwind CSS UI deployed on Vercel. Features:

- Query input textarea with Ctrl+Enter shortcut and 3 example query chips.
- Filter panel: company multiselect, year range picker, doc type checkboxes.
- Answer display with markdown rendering and loading skeleton.
- Citation panel: each citation shows company badge, doc type, year, section, 2-line excerpt (expandable).
- Error banner with retry button.

### 4.6 Evaluation

A structured benchmark of 30–50 questions with ground truth. Metrics computed:

- **Retrieval:** Precision@5 per question type, mean across all questions.
- **Generation:** Citation accuracy rate (cited indices resolve to real chunks), adversarial refusal rate, manual quality rating (1–5) for 20 sampled answers.
- **Latency:** p50/p95 for `retrieval_ms`, `rerank_ms`, `llm_ms`, `total_ms`.

At least one targeted improvement is implemented with before/after comparison.

---

## 5. V1 Out-of-Scope (explicitly deferred)

These are not cut for quality reasons — they are deferred to avoid over-engineering V1 and delaying completion:

- **Streaming (SSE/WebSocket):** Adds frontend complexity. Add in V2 when core pipeline is stable.
- **Authentication:** A public API with rate limiting (100 req/min on ALB) is sufficient for a portfolio demo.
- **Multi-turn conversation:** Start with single-turn Q&A. Conversation history is an optional V2 extension.
- **OCR pipeline:** SEC filings and earnings transcripts are machine-readable. Add Textract/Tesseract only when scanned PDFs are encountered.
- **Custom fine-tuned embeddings:** Use `text-embedding-3-small`. Fine-tuning is a V3 concern.
- **Macro / market news ingestion:** Separate ingestion pipeline. Keep V1 to structured financial documents.
- **Semantic / parent-child chunking:** Start with recursive character splitting (512 tokens, 50-token overlap). Revisit only if M6 evaluation shows retrieval is the bottleneck and chunk boundaries are the cause.
- **CI/CD beyond basic image push:** GitHub Actions build + push to ECR on merge to `main` is sufficient.

---

## 6. Non-Functional Requirements

| Requirement | Target |
|------------|--------|
| `/retrieve` p50 latency | < 800ms |
| `/query` p50 latency (no cache) | < 5 seconds |
| `/query` latency on cache hit | < 50ms |
| Citation accuracy | ≥ 85% (all cited indices resolve to real chunks) |
| Adversarial refusal rate | 100% (queries outside corpus must not hallucinate) |
| Retrieval Precision@5 | Target ≥ 0.75 after improvement iteration |
| Monthly AWS cost budget | < $20/month during active development |

---

## 7. Related Documents

- [project-overview.md](project-overview.md) – What the project is and why it was built
- [high-level-architecture.md](high-level-architecture.md) – System diagram and component breakdown
- [developer-tasks.md](developer-tasks.md) – Phased task breakdown with acceptance criteria
- [ingestion-implementation-process.md](ingestion-implementation-process.md) – End-to-end ingestion pipeline
- [query-answering-process.md](query-answering-process.md) – End-to-end query flow
- [evaluation-plan.md](evaluation-plan.md) – Benchmark design and metrics
