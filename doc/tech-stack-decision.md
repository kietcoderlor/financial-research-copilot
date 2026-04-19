# Tech Stack Decision

**Document type:** Design doc / stack decision  
**Scope:** V1 — Financial Research Copilot  
**Last updated:** April 2026

> This is the source of truth for stack decisions. When prompting Cursor or onboarding a new contributor, reference this file first.

---

## 1. Final V1 Stack

| Layer | Choice | Notes |
|------|--------|-------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS | Deployed on Vercel |
| Backend | FastAPI (Python 3.11+) | Deployed on ECS/Fargate |
| Database | PostgreSQL 15 (RDS) + pgvector extension | Metadata + vector chunks |
| Vector search | pgvector (collocated with Postgres) | Hybrid: cosine + tsvector |
| Queue | AWS SQS | Async ingestion jobs |
| Cache | Redis (ElastiCache Serverless) | Query result cache (TTL 24h) |
| Storage | AWS S3 | Raw document store |
| Deployment | AWS ECS/Fargate + Vercel | Backend + frontend |
| Logging | CloudWatch + structured JSON | Middleware-level per request |
| LLM | Anthropic API (Claude 3.5 Sonnet) | Generation |
| Embeddings | OpenAI `text-embedding-3-small` | 1536-dim, cost-effective |
| Reranker | Cohere Rerank API (rerank-v3.5) | Post-retrieval ranking |
| Secrets | AWS Secrets Manager | All credentials, no `.env` in prod |
| CI/CD | GitHub Actions | Build → ECR push → ECS deploy |

---

## 2. Why This Stack

### Frontend: Next.js (not React + Vite)

The UI needs a filter panel (company, date range, doc type), citation display with source highlighting, and potentially multi-turn conversation later. Next.js App Router handles these patterns cleanly. More importantly, Next.js is the frontend standard at most AI product companies. Vercel deploy is free and zero-config.

### Backend: FastAPI (not NestJS, not Flask)

Three hard reasons:
1. **Python ecosystem lock-in.** Cohere SDK, Anthropic SDK, pgvector client — all Python. Using Node means subprocess calls or a separate microservice.
2. **Async performance.** The query pipeline involves 3–4 concurrent I/O calls (embed → vector search → rerank → LLM). FastAPI + asyncio handles these well.
3. **Pydantic validation.** Request/response schema validation is automatic. Financial data (company names, date ranges, doc types) needs type safety.

### Database: Postgres + pgvector (not Pinecone, not OpenSearch)

Financial queries need: metadata filter (company, year), vector similarity, AND keyword match for precise financial terms like "EBITDA margin." pgvector handles all of this in a single SQL query using `embedding <=> $query_vec` combined with `ts_rank(tsv, query)`. With Pinecone you'd need two round trips and an extra join. pgvector also demonstrates retrieval engineering depth — not just an API call.

### Queue: AWS SQS (not Celery + Redis)

Ingestion takes 2–5 minutes per document (parse → chunk → 500 embedding API calls → write to Postgres). This cannot run in-process. SQS replaces the Redis broker that Celery requires, and a simple ECS polling worker handles consumption. AWS manages durability and retry. After 3 failures, messages route to a DLQ automatically.

### Deployment: ECS/Fargate (not Lambda, not EC2, not Render)

The project needs two long-running processes: the FastAPI server (always on) and the ingestion worker (polling SQS). Lambda is unsuitable because of cold start latency in the query pipeline (4 sequential API calls) and execution time limits. EC2 requires manual OS patching and instance management. ECS/Fargate handles everything once the Dockerfile is written. It also demonstrates AWS infrastructure knowledge in interviews.

### LLM: Anthropic Claude 3.5 Sonnet (not OpenAI GPT-4o)

Two reasons:
1. **Context window.** Claude 3.5 Sonnet has a 200K context window vs GPT-4o's 128K. A 10-K filing can be 150–300 pages. After retrieval, passing 20–30 chunks into the LLM is realistic. 200K removes the need for aggressive context truncation.
2. **Structured synthesis.** Claude performs well on structured outputs: comparison tables, bull/bear cases with sections, summaries with bullet points — exactly the output formats needed here.

Use Claude 3 Haiku for cheap classification tasks (metadata extraction, query type classification).

### Embeddings: OpenAI `text-embedding-3-small` (not `3-large`, not Cohere embed)

Cost-based decision. Embedding the full document corpus (SEC filings, transcripts) can be 50–100M tokens. At $0.02/1M tokens (3-small), total cost is $1–2. At $0.13/1M (3-large), it's $6–13. For a portfolio project, the quality delta doesn't justify the cost. The reranker fixes most retrieval errors downstream.

Upgrade to `3-large` or Voyage finance if M6 evaluation shows retrieval is the bottleneck.

### Reranker: Cohere Rerank (not local cross-encoder)

Vector similarity (cosine distance) measures semantic closeness, not relevance. A chunk about "Apple risk factors in 2018" may score high for a query about "Apple risk factors 2024" because the topic is the same. A cross-encoder reranker reads query and chunk together and scores direct relevance. Cohere Rerank is a single API call, no model hosting required, and it meaningfully improves Precision@5 in practice.

### Cache: Redis / ElastiCache Serverless (not in-memory dict)

Financial queries are repetitive. "Summarize Apple Q4 2024 earnings" will be asked many times. Without cache, each query costs ~2.4 seconds and $0.01–0.03 in API calls. With Redis keyed on `sha256(query + filters)`, repeated queries return in under 50ms at $0. ElastiCache Serverless scales to zero and charges per GB-hour — near-zero cost at portfolio project traffic levels.

### Observability: CloudWatch (not Datadog, not Grafana)

ECS logs ship automatically to CloudWatch. CloudWatch Logs Insights supports SQL-like queries. The key practice is emitting structured JSON logs per request:

```json
{
  "request_id": "abc123",
  "query": "Apple Q4 margins",
  "filters": {"company": "AAPL", "year": 2024},
  "retrieval_ms": 145,
  "rerank_ms": 203,
  "llm_ms": 1840,
  "total_ms": 2188,
  "chunks_retrieved": 20,
  "chunks_after_rerank": 5,
  "tokens_used": 3241
}
```

This lets you query: "What is the average LLM latency? Which queries are slowest? How many chunks does the reranker drop?" — concrete data for optimization and interview talking points.

---

## 3. What Not to Include in V1

These are explicitly deferred. Including them now is over-engineering that delays completion without improving the portfolio signal.

- **OpenSearch:** pgvector covers hybrid search adequately. OpenSearch adds significant operational overhead.
- **Celery:** SQS + a simple ECS worker task is cleaner and more AWS-native.
- **Kubernetes (EKS):** Overkill for a solo project. ECS/Fargate is the right balance.
- **Custom embedding fine-tuning:** Use hosted API. Fine-tuning is a V3 concern.
- **Multi-tenant auth:** A public API with rate limiting is sufficient for a portfolio demo.
- **Streaming UI (SSE/WebSockets):** Standard request/response is fine for V1.
- **Grafana / Datadog:** CloudWatch is sufficient and free at this scale.
- **OCR pipeline:** SEC filings are machine-readable. Add Textract only when scanned PDFs are encountered.
- **Multi-region deployment:** Single-region `us-east-1` is fine for a demo.
- **Full CI/CD (blue/green, rollback):** A GitHub Actions build + ECR push + ECS force-deploy is enough.

---

## 4. Interview Positioning

Common interview questions and how to answer them using this stack:

**"Why pgvector instead of Pinecone?"**
pgvector allows hybrid search in a single SQL query by combining cosine similarity with tsvector full-text search. For financial queries that need to filter by company and date, I didn't want two round trips between Pinecone and Postgres. pgvector scales to ~50M vectors which is more than enough, and it demonstrates that I understand the retrieval mechanism, not just API calls.

**"Why ECS instead of Lambda?"**
My query pipeline includes 4 sequential external calls (embed + vector search + rerank + LLM), total latency ~2–3 seconds at best case. Lambda cold start adds 1–3 seconds. For a conversational interface, acceptable latency is under 5 seconds — Lambda doesn't have enough headroom. ECS Fargate has no cold start and similar cost at moderate traffic.

**"Why Anthropic instead of OpenAI?"**
Claude 3.5 Sonnet has a 200K context window vs GPT-4o's 128K. A single 10-K can be 200 pages. With 200K context I can pass more retrieved chunks without aggressive truncation or context compression. Claude also performs well on structured synthesis tasks like comparison tables and bull/bear case generation.

**"Why do you need a reranker if you already have vector search?"**
Vector similarity measures semantic closeness, not relevance. A chunk about Apple risks in 2018 can score high for a query about Apple risks in 2024 because the topic is the same. A cross-encoder reranker reads both query and chunk simultaneously and scores direct relevance. In my evaluation, Precision@5 improved from X% to Y% after adding the reranker — measurable improvement, not an assumption.

---

## 5. Related Documents

- [knowledge-tech-stack.md](knowledge-tech-stack.md) – Beginner-friendly explanation of each technology
- [high-level-architecture.md](high-level-architecture.md) – How all components connect
- [back-end-guide.md](back-end-guide.md) – Backend folder structure, API routes, local dev setup
