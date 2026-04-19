# High-Level Architecture

**Document type:** Architecture reference  
**Scope:** V1 — Financial Research Copilot  
**Last updated:** April 2026

---

## 1. System Diagram

```
┌────────────────────────────────┐
│          Frontend UI           │
│    Next.js 14 + Tailwind CSS   │
│  query / filters / citations   │
└──────────────┬─────────────────┘
               │ HTTPS (Vercel → ALB)
               ▼
┌────────────────────────────────┐
│          API Layer             │
│    FastAPI on ECS/Fargate      │
│   /query   /retrieve  /ingest  │
│   /ingest/{id}   /health       │
└──────┬───────────────┬─────────┘
       │ query flow    │ ingestion trigger
       │               ▼
       │  ┌────────────────────────┐
       │  │    Ingestion Queue     │
       │  │        AWS SQS         │
       │  └───────────┬────────────┘
       │              ▼
       │  ┌────────────────────────┐
       │  │   Ingestion Worker     │
       │  │  (ECS Fargate task)    │
       │  │  parse/chunk/embed     │
       │  └────┬──────┬────────────┘
       │       │      │
       │       │      └──────────────┐
       │       ▼                     ▼
       │  ┌──────────┐    ┌──────────────────┐
       │  │  AWS S3   │    │  RDS PostgreSQL   │
       │  │  raw docs │    │  + pgvector       │
       │  └──────────┘    │  metadata + chunks │
       │                  │  embeddings + BM25 │
       │                  └────────┬───────────┘
       │                           │
       ▼                           ▼
┌──────────────────────────────────────────┐
│            Retrieval Pipeline            │
│  1. metadata filter (company/year/type)  │
│  2. vector search (pgvector cosine)      │
│  3. BM25 full-text search (tsvector)     │
│  4. Reciprocal Rank Fusion (RRF k=60)    │
│  5. Cohere Rerank v3.5 → top-5 chunks   │
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│          LLM Generation Layer            │
│  Anthropic Claude 3.5 Sonnet             │
│  - system prompt (context-only)          │
│  - numbered context blocks               │
│  - query type classification             │
│  - inline citation format [N]            │
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│             Final Response               │
│  { answer, citations, metadata }         │
│  - citations resolve to real chunk IDs   │
│  - metadata: latency breakdown, tokens   │
└──────────────────────────────────────────┘

Supporting services:
  Redis (ElastiCache Serverless) — query result cache (TTL 24h)
  AWS CloudWatch              — structured JSON logs, metrics, alarms
  GitHub Actions              — build Docker image → push ECR → deploy ECS
  Vercel                      — frontend deployment (zero config for Next.js)
```

---

## 2. Component Breakdown

### A. Frontend (Next.js + Tailwind on Vercel)

The demo UI is the public face of the project. It does not contain any AI logic — it is a thin client that calls the backend API.

Key components: `QueryInput`, `FilterPanel`, `AnswerDisplay`, `CitationPanel`, `ErrorBanner`.

The frontend reads `NEXT_PUBLIC_API_URL` from Vercel environment variables. No credentials live in frontend code.

### B. API Layer (FastAPI on ECS/Fargate)

The backend is a FastAPI application running in a Docker container on AWS ECS/Fargate. It exposes:

| Endpoint | Method | Purpose |
|---------|--------|---------|
| `/health` | GET | Health check (used by ALB target group) |
| `/query` | POST | Full RAG pipeline: retrieve → generate → cite |
| `/retrieve` | POST | Retrieval only (without generation) |
| `/ingest` | POST | Trigger ingestion job for a document |
| `/ingest/{id}` | GET | Check ingestion status |

All requests log a structured JSON record to CloudWatch: `request_id`, `path`, `status_code`, `duration_ms`.

### C. Ingestion Queue (AWS SQS)

When `POST /ingest` is called, the API inserts a row in the `documents` table with `status = 'pending'` and puts a message on the SQS queue containing `{s3_key, document_id}`.

The queue is configured with:
- Visibility timeout: 600 seconds (covers a full ingestion job)
- Dead Letter Queue (`ingestion-dlq`) after 3 failed receives

### D. Ingestion Worker (ECS Fargate task)

A separate ECS task (same Docker image, different CMD) runs `python -m app.ingestion.worker`. It polls SQS continuously.

For each message it: downloads the file from S3, selects the correct parser by `doc_type`, parses → chunks → embeds → batch inserts into `document_chunks`, updates `documents.status = 'done'`, deletes the SQS message.

On any error it updates `status = 'failed'` and does NOT delete the message (so SQS retries and eventually routes to DLQ).

### E. Storage Layer

Three distinct storage locations:

| Storage | Contents | Technology |
|--------|---------|-----------|
| Raw documents | Original files as uploaded | AWS S3 (`financial-copilot-raw-docs`) |
| Document metadata | `documents` table: s3_key, company, doc_type, year, quarter, status | RDS PostgreSQL 15 |
| Chunk data | `document_chunks` table: text, embedding, tsvector, metadata, chunk_index | RDS PostgreSQL 15 + pgvector |

Indexes on `document_chunks`:
- HNSW on `embedding` (`vector_cosine_ops`, m=16, ef_construction=64)
- GIN on `tsv` (full-text search)
- B-tree on `(company_ticker, year, quarter, doc_type)` (metadata filter)

### F. Retrieval Pipeline

Runs inside the FastAPI process on every `/query` or `/retrieve` request. Five steps in sequence:

1. **Query embedding** — embed the query using `text-embedding-3-small`. Cache result in Redis (key: `embed:{sha256(query)}`, TTL 1h).
2. **Vector search** — pgvector cosine distance with metadata filters. Returns top-20 candidates.
3. **BM25 / full-text search** — `plainto_tsquery` + `ts_rank` on `tsvector` column. Returns top-20 candidates.
4. **RRF fusion** — merge and deduplicate by `chunk_id` using `score = sum(1 / (60 + rank))`. Returns unified ranked list.
5. **Cohere reranker** — `cohere.rerank(model="rerank-v3.5", top_n=5)`. Maps back to full `ChunkResult` objects.

Latency is tracked per step: `embed_ms`, `vector_ms`, `bm25_ms`, `rerank_ms`, `total_ms`.

### G. LLM Generation Layer

Runs inside the FastAPI process after retrieval. Steps:

1. Query type classifier (keyword heuristics → `single_company`, `comparison`, `bull_bear`, `general`).
2. Context builder — format each chunk as `[N] Company: {ticker} | Source: {doc_type} {year} | Section: {section}\n{chunk_text}`. Token budget check: drop lowest-ranked chunks if total > 150K tokens.
3. LLM call — `anthropic.messages.create(model="claude-sonnet-4-5", max_tokens=2048)`.
4. Citation parser — extract `[N]` indices from answer text, map to `ChunkResult`. Flag hallucinated citations (indices that don't exist in provided chunks).

Cost is logged per request: `(input_tokens * 0.000003 + output_tokens * 0.000015)` → CloudWatch metric `LLMCostUSD`.

### H. Supporting Services

**Redis (ElastiCache Serverless):** Query-level cache. Key: `query:{sha256(question + json(filters))}`. TTL: 24h. Cache hits return `metadata.cache_hit: true`. Cache miss/hit counter logged to CloudWatch.

**CloudWatch:** Structured JSON logs from FastAPI middleware. Logs Insights queries for p50/p95 latency. Alarms for: ECS task unhealthy, SQS DLQ message count > 0, RDS CPU > 80%, LLM cost > $1/day.

---

## 3. Query Flow (step by step)

```
User submits question + filters
  → Frontend calls POST /query
  → API checks Redis cache
    → Cache hit: return cached response (< 50ms)
    → Cache miss: continue
  → Validate filters (non-empty query, valid tickers)
  → Embed query (Redis cache for embedding, TTL 1h)
  → Vector search (pgvector, filtered by metadata)
  → BM25 full-text search (tsvector, same filters)
  → RRF fusion (deduplicate, merge scores)
  → Cohere rerank (top-5 chunks)
  → Build context string (numbered blocks)
  → Classify query type
  → Call Anthropic Claude (system prompt + context + query)
  → Parse citations from answer text
  → Validate citation indices (flag hallucinated)
  → Store result in Redis cache
  → Return structured response: { answer, citations, metadata }
  → Frontend renders answer + citation panel
```

---

## 4. Ingestion Flow (step by step)

```
Client calls POST /ingest { s3_key, company_ticker, doc_type, year, quarter, source_url }
  → API inserts row in documents (status = 'pending')
  → API puts message on SQS: { s3_key, document_id }
  → API returns { document_id, status: "queued" }

Ingestion worker (polling SQS):
  → Receive message from SQS
  → Download file from S3 to /tmp/
  → Select parser by doc_type (sec_parser / transcript_parser / pdf_parser)
  → Parse → clean text → detect sections
  → Chunk with RecursiveCharacterTextSplitter (512 tokens, 50 overlap)
  → Generate embeddings in batches of 100 (OpenAI text-embedding-3-small)
  → Deduplication check: skip (document_id, chunk_index) if already exists
  → Batch INSERT into document_chunks
  → Update documents.status = 'done'
  → Delete SQS message

On error:
  → Update documents.status = 'failed'
  → Do NOT delete SQS message
  → After 3 failures: message routes to ingestion-dlq
```

---

## 5. Infrastructure Map

| Service | AWS resource | Purpose |
|--------|-------------|---------|
| Backend API | ECS/Fargate (sg-backend) | FastAPI server |
| Ingestion worker | ECS/Fargate (sg-backend) | SQS polling worker |
| Database | RDS PostgreSQL 15 (sg-rds) | Metadata + chunk storage |
| Cache | ElastiCache Serverless (sg-redis) | Query + embedding cache |
| Queue | SQS standard queue | Async ingestion jobs |
| DLQ | SQS dead letter queue | Failed ingestion jobs |
| Raw storage | S3 (versioned) | Original documents |
| Container registry | ECR | Docker images |
| Load balancer | ALB (public subnet) | HTTP traffic → ECS |
| Secrets | Secrets Manager | API keys, DB credentials |
| Logging | CloudWatch Logs | Structured JSON logs |
| Networking | VPC, 2 private + 1 public subnet | Isolation + NAT |
| CI/CD | GitHub Actions | Build → ECR → ECS deploy |
| Frontend | Vercel | Next.js deployment |

---

## 6. Related Documents

- [tech-stack-decision.md](tech-stack-decision.md) – Why each component was chosen
- [ingestion-implementation-process.md](ingestion-implementation-process.md) – Ingestion pipeline in detail
- [query-answering-process.md](query-answering-process.md) – Query flow in detail
- [back-end-guide.md](back-end-guide.md) – Backend folder structure and local dev setup
