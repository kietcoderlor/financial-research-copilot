# Developer Task Assignment

This document breaks down the Financial Research Copilot project into **concrete, executable tasks**. Each task has an ID, scope, dependencies, and acceptance criteria.

**See also:** [requirements.md](requirements.md) · [high-level-architecture.md](high-level-architecture.md) · [back-end-guide.md](back-end-guide.md)

---

## Task ID Convention

- **P1** = Phase 1 (Foundation & Infrastructure)
- **P2** = Phase 2 (Ingestion Pipeline)
- **P3** = Phase 3 (Retrieval Layer)
- **P4** = Phase 4 (Generation & Citations)
- **P5** = Phase 5 (Frontend & Integration)
- **P6** = Phase 6 (Evaluation & Portfolio Finish)
- **INFRA** = Cross-cutting infrastructure tasks

**Scope:** S = Small (≈0.5–1 day) · M = Medium (1–2 days) · L = Large (2–3 days)

---

## Status Summary

| Phase | Tasks | Done | Status |
|-------|-------|------|--------|
| **P1** Foundation & Infra | 16 | 16 | Complete |
| **P2** Ingestion Pipeline | 15 | 15 | Complete |
| **P3** Retrieval Layer | 9 | 0 | Not started |
| **P4** Generation & Citations | 9 | 0 | Not started |
| **P5** Frontend & Integration | 12 | 0 | Not started |
| **P6** Evaluation & Portfolio | 9 | 0 | Not started |
| **INFRA** Cross-cutting | 5 | 0 | Not started |

---

## Phase 1: Foundation & Infrastructure

*Must be completed before any application logic. Goal: full AWS skeleton running, local dev environment mirroring production.*

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| P1-1 | **AWS account & IAM** – Create dedicated IAM user with programmatic access. Attach policies: S3, RDS, SQS, ECS, ElastiCache, CloudWatch, ECR. Test with `aws sts get-caller-identity`. Set default region `us-east-1`. | S | — | DONE |
| P1-2 | **VPC & networking** – Create VPC with 2 private subnets + 1 public subnet. Attach Internet Gateway. Create NAT Gateway in public subnet. Create 3 security groups: `sg-backend` (inbound 8000 from ALB), `sg-rds` (inbound 5432 from sg-backend only), `sg-redis` (inbound 6379 from sg-backend only). | M | P1-1 | DONE |
| P1-3 | **S3 buckets** – Create `financial-copilot-raw-docs` (versioning on, block all public access). Test: `aws s3 cp test.txt s3://financial-copilot-raw-docs/test.txt`. | S | P1-1 | DONE |
| P1-4 | **SQS queues** – Create standard queue `ingestion-queue`. Create dead letter queue `ingestion-dlq`. Configure `ingestion-queue` to forward to DLQ after 3 failed receives. Set visibility timeout = 600s. Test: send + receive a message via AWS CLI. | S | P1-1 | DONE |
| P1-5 | **RDS Postgres** – Provision RDS Postgres 15 (`db.t3.micro`, 20GB gp2, single-AZ). Place in private subnet, attach `sg-rds`. After provisioning, run `CREATE EXTENSION IF NOT EXISTS vector;`. Confirm with `SELECT * FROM pg_extension WHERE extname = 'vector';`. | M | P1-2 | DONE |
| P1-6 | **ElastiCache Redis** – Create ElastiCache Serverless cache (Redis-compatible). Place in private subnet, attach `sg-redis`. Note endpoint URL. | S | P1-2 | DONE |
| P1-7 | **Secrets Manager** – Store all credentials: `DB_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `COHERE_API_KEY`, `SQS_QUEUE_URL`. Confirm ECS task role can call `secretsmanager:GetSecretValue`. | S | P1-1 | DONE |
| P1-8 | **Project repo structure** – Initialize GitHub repo. Create folder structure: `/app/api`, `/app/ingestion`, `/app/retrieval`, `/app/generation`, `/app/models`, `/app/db`, `/app/core`, `/tests`, `Dockerfile`, `docker-compose.yml`, `requirements.txt`. | S | — | DONE |
| P1-9 | **FastAPI skeleton** – Create `GET /health` returning `{"status": "ok", "version": "0.1.0"}`. Add structured JSON logging middleware (logs `request_id`, `path`, `method`, `status_code`, `duration_ms` per request). Add global exception handler returning `{"error": "...", "request_id": "..."}`. Configure settings via `pydantic-settings` reading from env vars. | M | P1-8 | DONE |
| P1-10 | **Dockerfile** – Write Dockerfile using `python:3.11-slim`, non-root user, no dev dependencies in image. Confirm `docker build` succeeds locally. | S | P1-9 | DONE |
| P1-11 | **Docker Compose (local dev)** – Write `docker-compose.yml` with services: `api` (FastAPI), `postgres` (ankane/pgvector image), `redis`, `elasticmq` (local SQS). Confirm `docker compose up` starts all services without errors and `/health` responds. | M | P1-10 | DONE |
| P1-12 | **ECR repository** – Create ECR repository `financial-copilot-api`. Build Docker image locally, tag, and push to ECR. Confirm image appears in ECR console. | S | P1-10 | DONE |
| P1-13 | **ECS cluster + task definition** – Create ECS cluster `financial-copilot`. Write task definition: container from ECR, 512 CPU / 1024 MB memory, env vars from Secrets Manager. | M | P1-12 | DONE |
| P1-14 | **ALB + ECS service** – Create Application Load Balancer in public subnet, listener port 80, forward to ECS target group. Create ECS service (Fargate, 1 desired task, private subnet, `sg-backend`). Confirm `curl http://<alb-dns>/health` returns `{"status": "ok"}`. | M | P1-13 | DONE |
| P1-15 | **CloudWatch log group** – Confirm ECS task ships logs to `/ecs/financial-copilot`. Run a sample query in CloudWatch Logs Insights confirming structured JSON is parseable. | S | P1-14 | DONE |
| P1-16 | **GitHub Actions CI** – Add `.github/workflows/deploy.yml`: on push to `main`, build Docker image, push to ECR, force new ECS deployment. Store `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as GitHub Actions secrets. | M | P1-13 | DONE |

**Bootstrap note (historical):** ECS task definitions load secrets from Secrets Manager (**P1-7**). If you ever used plain env vars in a task definition during bootstrap, rotate those values and rely on Secrets Manager only before Phase 2.

### Phase 1 — Status (complete)

| Area | Status |
|------|--------|
| IAM + `us-east-1`; GitHub Actions secrets; `aws sts get-caller-identity` | Done |
| VPC + NAT + SGs via **`infra/terraform`** (**P1-2**) | Done |
| S3 raw bucket, SQS + DLQ (**P1-3**, **P1-4**) | Done |
| RDS Postgres 15 + **pgvector** on prod DB (**P1-5**) | Done (`vector` extension verified) |
| ElastiCache Redis (**P1-6**) | Done |
| Secrets Manager + ECS task/execution roles (**P1-7**) | Done |
| ECR `financial-copilot-api`; CI build/push; ECS Fargate service (**P1-12**–**P1-13**, **P1-16**) | Done |
| ALB + `curl` `/health` via ALB (**P1-14**) | Done |
| Log group `/ecs/financial-copilot` + structured JSON logs (**P1-15**) | Done |

**Ops hygiene (post Phase 1):** If a temporary EC2 bastion or extra RDS inbound rule (5432 from bastion SG) was used for `CREATE EXTENSION`, terminate the bastion and remove that inbound rule so only **`financial-copilot-backend`** may reach RDS on 5432. Rotate the DB master password if it was ever exposed (screenshots, chat, committed notes).

**Definition of done (Phase 1):** `curl http://<alb-dns>/health` returns 200 OK from ECS. `docker compose up` starts full local stack. All secrets in Secrets Manager, no credentials in code. GitHub Actions deploys on push to `main`. CloudWatch shows structured JSON logs.

---

## Phase 2: Ingestion Pipeline

*Goal: upload a document to S3 → worker parses, chunks, embeds, writes to pgvector. Corpus queryable at DB level by end of phase.*

**Batch 1 (in repo):** Alembic + revision `p2_batch1_001` (tables + indexes). Run migrations yourself: `docker compose up -d postgres` then `docker compose run --rm api python -m alembic upgrade head`, or `.\scripts\alembic-upgrade.ps1` with `DB_URL` pointing at Compose/RDS (sync URL uses `postgresql://` internally). On RDS, use the same command from a host with `DB_URL` (e.g. CI job, bastion with Python, or one-off ECS task).

**Ingest pipeline (P2-4–P2-15):** After seeding, run `python scripts/check_corpus.py` (needs `DB_URL`; for DLQ use `SQS_QUEUE_URL` + `SQS_ENDPOINT_URL` locally). Worker routes by `doc_type` / bytes: **SEC HTML** (`10-K`/`10-Q`) → `sec_parser` + sections; **`transcript`** → `transcript_parser` (`prepared_remarks` / `qa`); **PDF** (`%PDF` magic or `letter` / `shareholder_letter` / `pdf`) → `pdf_parser`; else plain UTF-8. **Chunking:** `app/ingestion/chunker.py` (LangChain + tiktoken, 512 / 50). **Embeddings:** `app/ingestion/embedder.py` (`text-embedding-3-small`, tenacity; zeros if no `OPENAI_API_KEY`). **P2-12 (prod):** Terraform defines ECS task definition + service `${project_name}-worker` (default `financial-copilot-worker`), same ECR image as API, `CMD` `python -m app.ingestion.worker`; GitHub Actions forces a new deployment for both services. **P2-14** / S3 still needs real AWS or `S3_ENDPOINT_URL` for local.

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id`, `s3_key`, `company_ticker`, `company_name`, `doc_type`, `year`, `quarter`, `source_url`, `ingested_at`, `status`) and `document_chunks` (`id`, `document_id FK`, `chunk_index`, `chunk_text`, `embedding vector(1536)`, `tsv tsvector GENERATED`, `section`, `company_ticker`, `doc_type`, `year`, `quarter`, `token_count`). | M | P1-5 | DONE |
| P2-2 | **Indexes** – Create three indexes after migration: HNSW on `embedding` (`vector_cosine_ops`, m=16, ef_construction=64), GIN on `tsv`, and btree on `(company_ticker, year, quarter, doc_type)`. Confirm with `\d document_chunks` in psql. | S | P2-1 | DONE |
| P2-3 | **Alembic migrate (local + prod)** – Run `alembic upgrade head` against local Docker Compose Postgres. Confirm tables and indexes exist. Run same migration against RDS. | S | P2-2, P1-5 | DONE |
| P2-4 | **SEC filing parser** – Write `app/ingestion/parsers/sec_parser.py`. Install `sec-edgar-downloader`. Download 10-K/10-Q by ticker + year. Extract plain text from HTML using `beautifulsoup4`, strip headers/footers/boilerplate. Detect and label sections: `risk_factors`, `mda`, `business`, `quantitative_disclosures`. Test: parse Apple 10-K 2023, confirm section labels present and text is clean. | L | — | DONE |
| P2-5 | **Earnings transcript parser** – Write `app/ingestion/parsers/transcript_parser.py`. Source: Kaggle earnings call dataset or static HTML. Parse speaker turns, label sections as `prepared_remarks` vs `qa`. Test: parse one transcript, confirm speaker labels present. | M | — | DONE |
| P2-6 | **PDF parser (shareholder letters)** – Write `app/ingestion/parsers/pdf_parser.py` using `pdfplumber`. Handle basic multi-column layouts. Test: parse Berkshire Hathaway 2023 annual letter, confirm extracted text is readable and clean. Flag unreadable pages with a warning log (do not crash). | M | — | DONE |
| P2-7 | **Chunker** – Write `app/ingestion/chunker.py`. Use `langchain.text_splitter.RecursiveCharacterTextSplitter` with `chunk_size=512`, `chunk_overlap=50` (token-based via `tiktoken`). Each chunk inherits `section` from parent. Return list of `ChunkRecord(text, section, chunk_index, token_count)`. Test: chunk a 10-K, confirm no chunk exceeds 600 tokens and section labels are propagated. | M | — | DONE |
| P2-8 | **Embedder** – Write `app/ingestion/embedder.py`. Call `openai.embeddings.create(model="text-embedding-3-small")` in batches of 100 chunks. Add retry with exponential backoff using `tenacity` for rate limit errors (429). Return `list[list[float]]`. Test: embed 10 chunks, confirm output shape `(10, 1536)`. | M | — | DONE |
| P2-9 | **Ingestion worker loop** – Write `app/ingestion/worker.py`. Poll SQS for messages. For each message: download file from S3 to `/tmp/`, select correct parser by `doc_type`, parse → chunk → embed → batch INSERT into `document_chunks`, update `documents.status = 'done'`, delete SQS message. On any error: update `status = 'failed'`, do NOT delete message (let DLQ catch it after 3 retries). Log each step with `document_id` and `chunk_count`. | L | P2-3 | DONE |
| P2-10 | **POST /ingest endpoint** – Accept `{s3_key, company_ticker, doc_type, year, quarter, source_url}`. Insert row in `documents` with `status = 'pending'`. Put message `{s3_key, document_id}` on SQS. Return `{document_id, status: "queued"}`. | S | P2-3 | DONE |
| P2-11 | **GET /ingest/{document_id} endpoint** – Return current document status and chunk count. Return 404 if document not found. | S | P2-10 | DONE |
| P2-12 | **Ingestion worker ECS task** – Add second ECS task definition (same Docker image, CMD: `python -m app.ingestion.worker`). Deploy as ECS service (1 desired task). Confirm worker starts, polls SQS, and logs are visible in CloudWatch. | M | P1-14, P2-9 | DONE |
| P2-13 | **Deduplication guard** – Before inserting a chunk, check if a row with `(document_id, chunk_index)` already exists. Skip if duplicate. Prevents re-embedding if ingestion is re-triggered for the same document. | S | P2-9 | DONE |
| P2-14 | **Corpus seeding** – Write `scripts/seed_corpus.py`. Upload 3 documents to S3 (one 10-K, one transcript, one shareholder letter). Call `POST /ingest` for each. Poll `GET /ingest/{id}` until all `status = 'done'`. | S | P2-11 | DONE |
| P2-15 | **Corpus validation script** – Write `scripts/check_corpus.py`. Run: `SELECT company_ticker, doc_type, year, COUNT(*) FROM document_chunks GROUP BY 1,2,3 ORDER BY 1,2,3`. Print results. Confirm embeddings are non-null and dimension = 1536. Confirm DLQ is empty. | S | P2-14 | DONE |

**Definition of done (Phase 2):** `SELECT COUNT(*) FROM document_chunks > 500`. Three document types present. All embedding values non-null with dimension 1536. `documents` table has no `status = 'failed'` rows after clean run. DLQ message count = 0.

---

## Phase 3: Retrieval Layer

*Goal: given a query + filters, return top-5 most relevant chunks. Validate retrieval quality manually before adding generation.*

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| P3-1 | **Query embedder** – Write `app/retrieval/query_embedder.py`. Embed user query using `text-embedding-3-small` (same model as ingestion). Cache result in Redis: key = `embed:{sha256(query)}`, TTL = 1 hour. Test: embed "What are Apple's key risk factors?" and confirm shape `(1536,)`. | S | P1-6, P2-8 | - |
| P3-2 | **Vector search** – Write `app/retrieval/vector_search.py`. Query pgvector using `embedding <=> $query_vec` cosine distance with optional filters on `company_ticker`, `year`, `doc_type`. Return top-20 candidates with `chunk_id`, `chunk_text`, `metadata`, `score`. | M | P2-2 | - |
| P3-3 | **BM25 / full-text search** – Write `app/retrieval/bm25_search.py`. Query `tsvector` column using `plainto_tsquery` + `ts_rank`. Apply same metadata filters as vector search. Return top-20 candidates with rank score. | M | P2-2 | - |
| P3-4 | **Reciprocal Rank Fusion (RRF)** – Write `app/retrieval/fusion.py`. Implement RRF: `score = sum(1 / (k + rank))` for k=60 across vector and BM25 result lists. Deduplicate by `chunk_id`, merge scores, return unified ranked list. Test: compare top-10 from vector-only, BM25-only, and RRF on 5 sample queries; confirm RRF is at least as good as either alone. | M | P3-2, P3-3 | - |
| P3-5 | **Cohere reranker** – Write `app/retrieval/reranker.py`. Call `cohere.rerank(model="rerank-v3.5", query=query, documents=[c.chunk_text for c in candidates], top_n=5)`. Map results back to full `ChunkResult` objects with rerank score. Truncate chunk text to 512 tokens before passing to Cohere (avoids token limit errors). | M | — | - |
| P3-6 | **Retrieval pipeline orchestration** – Write `app/retrieval/pipeline.py`. Function `retrieve(query, filters, top_k=20, top_n=5)`: call P3-1 → P3-2 → P3-3 → P3-4 → P3-5. Return `RetrievalResult(chunks, latency_breakdown)` where `latency_breakdown` records `embed_ms`, `vector_ms`, `bm25_ms`, `rerank_ms`, `total_ms`. | M | P3-1, P3-4, P3-5 | - |
| P3-7 | **POST /retrieve endpoint** – Accept `{query: str, filters: {companies: list[str], years: list[int], doc_types: list[str]}}`. Call retrieval pipeline. Return `{chunks: [{id, text, company, doc_type, year, section, score}], latency: {...}}`. Validate: query non-empty; if companies provided, confirm tickers exist in corpus (return 400 otherwise). | M | P3-6 | - |
| P3-8 | **Retrieval latency logging** – Log `embed_ms`, `vector_ms`, `bm25_ms`, `rerank_ms`, `total_ms` per request as structured JSON to CloudWatch. Create a Logs Insights query to compute p50/p95 latency across steps. | S | P3-7 | - |
| P3-9 | **Manual retrieval evaluation (notebook)** – Create `eval/retrieval_spot_check.ipynb`. Define 15–20 test queries with expected company/topic. For each, call `POST /retrieve`, display top-5 chunks. Manually mark each result Relevant / Partial / Not Relevant. Compute Precision@5. Save results to `eval/retrieval_results.md`. | M | P3-7 | - |

**Definition of done (Phase 3):** Query "Apple risk factors 2024" with `{companies: ["AAPL"], years: [2024]}` returns 5 chunks, all from Apple 2024 documents. Manual eval: ≥12/15 spot-check queries have visibly relevant top-5. Response time < 800ms p50. Filter `{doc_types: ["10-K"]}` correctly excludes transcript chunks.

---

## Phase 4: Generation & Citations

*Goal: LLM synthesizes grounded answers from retrieved context, every claim linked to a source chunk.*

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| P4-1 | **Context builder** – Write `app/generation/context_builder.py`. Format each chunk as a numbered block: `[N] Company: {ticker} \| Source: {doc_type} {year} \| Section: {section}\n{chunk_text}`. Add token budget check: if total context > 150K tokens, drop lowest-ranked chunks. Test: build context from 5 chunks, confirm formatting and indices are correct. | S | — | - |
| P4-2 | **System prompt** – Write `app/generation/prompts/system_prompt.txt`. Rules: answer using ONLY provided context, cite every factual claim with `[N]`, respond with "I don't have sufficient information" if context is insufficient, do not use training knowledge not in context. Include format instructions: direct answer first, supporting detail, citations summary. Manually test prompt in Claude.ai before wiring to code. | M | — | - |
| P4-3 | **Query type classifier** – Write `app/generation/classifier.py`. Classify query as `single_company`, `comparison`, `bull_bear`, or `general`. Use simple keyword heuristics (e.g. "compare", "vs", "versus" → comparison; "bull case", "bear case" → bull_bear). Add format-specific instructions per query type to the user message. | S | — | - |
| P4-4 | **LLM integration** – Write `app/generation/llm.py`. Call `anthropic.messages.create(model="claude-sonnet-4-5", max_tokens=2048, system=system_prompt, messages=[...])`. Accept `query`, `context_str`, `query_type`. Return `LLMResponse(answer_text, input_tokens, output_tokens)`. Add estimated cost logging to CloudWatch metric `LLMCostUSD`. | M | P4-2, P4-3 | - |
| P4-5 | **Citation parser** – Write `app/generation/citation_parser.py`. Extract citation indices from answer text using regex `\[(\d+(?:,\s*\d+)*)\]`. Map each index to corresponding `ChunkResult`. Validate: flag any cited index that does not exist in the provided chunks as a hallucinated citation (log warning, exclude from response citations). | M | — | - |
| P4-6 | **Redis cache for /query** – Implement query-level cache. Key = `query:{sha256(question + json(filters))}`, TTL = 24 hours. On cache hit, return cached result with `metadata.cache_hit: true`. Add cache miss/hit counter metric to CloudWatch. | S | P1-6 | - |
| P4-7 | **POST /query endpoint** – Accept `{question: str, filters: {...}}`. Orchestrate: P3-6 retrieve → P4-1 build context → P4-4 generate → P4-5 parse citations. Return structured response: `{answer, citations: [{index, chunk_id, company, doc_type, year, section, source_url, excerpt}], metadata: {query_type, chunks_retrieved, chunks_used, retrieval_ms, llm_ms, input_tokens, output_tokens, total_ms}}`. | M | P4-4, P4-5, P4-6, P3-6 | - |
| P4-8 | **Adversarial query handling** – Test 5 adversarial queries (company not in corpus, future predictions, unrelated topics). Confirm all return the "insufficient information" response, not hallucinated answers. Adjust system prompt if needed. Document results in `eval/generation_spot_check.md`. | S | P4-7 | - |
| P4-9 | **End-to-end manual validation** – Test 10 queries via Postman: 3 single-company, 3 comparison, 2 bull/bear, 2 adversarial. For each: confirm citations resolve to real chunk IDs, confirm answer is grounded in retrieved text. Log all results in `eval/generation_spot_check.md`. | M | P4-8 | - |

**Definition of done (Phase 4):** `POST /query` returns structured answer + citations. All cited indices map to real chunk IDs. Adversarial queries return "insufficient information". Second identical query returns < 50ms from Redis cache. `metadata.total_ms` logged per request in CloudWatch.

---

## Phase 5: Frontend & Integration

*Goal: Next.js demo UI connected to deployed backend, publicly accessible at a shareable Vercel URL.*

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| P5-1 | **CORS config** – Add `CORSMiddleware` to FastAPI. Allow origins: `https://*.vercel.app`, `http://localhost:3000`. Allow all methods and headers. Deploy update to ECS. Confirm browser request from `localhost:3000` does not get blocked. | S | P4-7 | - |
| P5-2 | **Next.js project setup** – Initialize Next.js 14 (App Router) + Tailwind CSS. Create `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000` and `.env.production` with ALB URL. Create `lib/apiClient.ts` wrapping fetch calls to `/query` and `/retrieve`. | S | — | - |
| P5-3 | **QueryInput component** – Textarea for question, submit button, keyboard shortcut (Ctrl+Enter to submit). Disable button while loading. Show character count. Add 3 example query chips below input that prefill the textarea on click. | S | P5-2 | - |
| P5-4 | **FilterPanel component** – Company multiselect dropdown (hardcoded list of ingested tickers), year range picker (min/max year), doc type checkboxes (10-K, 10-Q, transcript, letter). All filters optional — unselected means "search all". | M | P5-2 | - |
| P5-5 | **AnswerDisplay component** – Render answer text as markdown using `react-markdown`. Show loading skeleton (3 animated lines) while API call is in flight. Show empty state when no query submitted yet. | S | P5-2 | - |
| P5-6 | **CitationPanel component** – List citations returned by `/query`. Each citation shows: company badge, doc type, year, section label, and a 2-line excerpt. Expand on click to show full chunk text. | M | P5-2 | - |
| P5-7 | **ErrorBanner component** – Show user-friendly error message when API returns non-200. Include a retry button. Distinguish between "no results found" and "server error". | S | P5-2 | - |
| P5-8 | **Page layout** – Create `app/page.tsx`. Layout: header ("Financial Research Copilot" + tagline), left column (QueryInput + FilterPanel), main column (AnswerDisplay + CitationPanel). Add footer: "Answers are grounded in SEC filings, earnings transcripts, and company reports. All claims are cited." | M | P5-3, P5-4, P5-5, P5-6, P5-7 | - |
| P5-9 | **API wiring** – Wire QueryInput submit → call `apiClient.query()` → update AnswerDisplay + CitationPanel state. Handle loading, error, and empty states. Log query + response in browser console in development. | M | P5-8 | - |
| P5-10 | **Vercel deployment** – Push Next.js repo to GitHub. Connect to Vercel. Set `NEXT_PUBLIC_API_URL` env var in Vercel project settings. Confirm deployment succeeds and page loads at Vercel URL. | S | P5-9 | - |
| P5-11 | **End-to-end browser test** – Open Vercel URL in incognito browser. Submit 3 different queries with different filter combinations. Confirm answers and citations render correctly. Confirm error state shows when API is unreachable. | S | P5-10 | - |
| P5-12 | **ALB rate limiting** – Configure API Gateway or ALB to limit to 100 requests/minute. Confirm 429 is returned on excess and handled gracefully by the frontend error banner. | S | P1-14 | - |

**Definition of done (Phase 5):** Open Vercel URL in incognito browser, ask a question, receive a cited answer. FilterPanel restricts results correctly. Error state shows gracefully when API is unreachable. Loading skeleton shows during API call. No hardcoded credentials anywhere in frontend code.

---

## Phase 6: Evaluation & Portfolio Finish

*Goal: structured benchmark with concrete metrics, one targeted improvement with before/after comparison, complete portfolio artifacts.*

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| P6-1 | **Evaluation dataset** – Create `eval/questions.csv` with columns: `id`, `question`, `filters`, `expected_companies`, `question_type`, `ground_truth_summary`. Write 30–50 questions: 15 single-company factual, 10 multi-company comparison, 8 synthesis, 5 bull/bear, 5 adversarial. For each factual question, manually find and record the ground truth in the source document. | L | P4-7 | - |
| P6-2 | **Retrieval evaluation script** – Write `eval/evaluate_retrieval.py`. For each question in `questions.csv`, call `POST /retrieve`. Manually label each top-5 result as Relevant (1) or Not Relevant (0). Compute Precision@5 per question and mean across all questions. Save to `eval/retrieval_scores.md`. | M | P6-1, P3-7 | - |
| P6-3 | **Generation evaluation script** – Write `eval/evaluate_generation.py`. For each question, call `POST /query`. Check: (1) all cited indices map to real chunks (citation accuracy), (2) adversarial questions return refusal, (3) manual 1–5 quality rating for 20 sampled answers. Compute citation accuracy rate, adversarial refusal rate, mean quality score. Save to `eval/generation_scores.md`. | M | P6-1, P4-7 | - |
| P6-4 | **Identify worst-performing queries** – From `eval/retrieval_scores.md`, isolate the 5 queries with lowest Precision@5. Determine root cause: missing data, bad chunking, retrieval strategy failure, or metadata mismatch. Document findings in `eval/failure_analysis.md`. | S | P6-2 | - |
| P6-5 | **One targeted improvement** – Based on P6-4 findings, implement exactly one fix. Examples: if Precision@5 < 0.6, experiment with `chunk_overlap=100` and re-embed; if BM25 underperforms, switch to `websearch_to_tsquery`; if citation accuracy < 80%, add post-processing validation step. Re-run evaluation. Record before/after metrics in `eval/improvement_results.md`. | M | P6-4 | - |
| P6-6 | **Architecture diagram** – Create system diagram in Excalidraw or draw.io showing: S3 → SQS → ECS ingestion worker → RDS Postgres ← ECS API ← ALB ← user browser → Vercel. Include: Redis cache, CloudWatch, ECR. Export as PNG. | S | — | - |
| P6-7 | **README.md** – Write complete README: project overview (2 sentences), architecture diagram embed, tech stack table, key engineering decisions (why pgvector, why hybrid retrieval, why Cohere Rerank, why Claude), evaluation results (Precision@5 before/after, citation accuracy, example Q&A pair), how to run locally (`docker compose up` + seed script), live demo link + GitHub link. | M | P6-5, P6-6 | - |
| P6-8 | **Demo screen recording** – Record 60–90 second screen capture showing: open demo URL → ask single-company question (point out citations) → ask comparison question (show multi-company result) → demonstrate filter panel restricting results. Export as GIF or link to Loom. Embed in README. | S | P5-11 | - |
| P6-9 | **Resume update** – Make GitHub repo public. Add project to resume: "Financial Research Copilot (AWS) — Built a production RAG system for financial document analysis. Hybrid retrieval (BM25 + pgvector + Cohere Rerank), Precision@5 of X%. Deployed on ECS/Fargate with async SQS ingestion. Stack: FastAPI, Postgres, pgvector, Next.js, AWS." Add demo link. | S | P6-7, P6-8 | - |

**Definition of done (Phase 6):** Evaluation dataset exists with 30+ questions and ground truth. Precision@5 computed and documented with before/after comparison. Citation accuracy ≥ 85%. README complete with diagram, stack, decisions, eval results, and local run instructions. Repo public with demo link live.

---

## Cross-Cutting / Infrastructure

| ID | Task | Scope | Deps | Done |
|----|------|-------|------|------|
| INFRA-1 | **Alembic migration workflow** – Document migration commands in README: `alembic revision --autogenerate -m "..."`, `alembic upgrade head`, `alembic downgrade -1`. Add migration check to CI: fail if uncommitted migrations exist. | S | P2-1 | - |
| INFRA-2 | **Cost monitoring** – Set up AWS Budget alert at $20/month. Add CloudWatch metric `LLMCostUSD` (computed per request in P4-4). Add dashboard widget showing daily LLM cost + ECS + RDS + ElastiCache. | S | P1-15 | - |
| INFRA-3 | **CloudWatch alarms** – Create alarms for: ECS task unhealthy (desired ≠ running), SQS DLQ message count > 0, RDS CPU > 80%, LLM cost > $1/day. Send alerts to email via SNS. | S | P1-15 | - |
| INFRA-4 | **Local seed data script** – Write `scripts/seed_local.py`. Download 3 sample documents (AAPL 10-K 2023, AAPL Q3 2024 transcript, Berkshire 2023 letter) to `/tmp/`. Upload to local S3 (LocalStack/ElasticMQ). Trigger ingestion against local Docker Compose stack. | M | P2-14 | - |
| INFRA-5 | **`.env.example` file** – Create `.env.example` listing all required environment variables with placeholder values and inline comments explaining each. Ensure no real credentials are committed. Add `.env` to `.gitignore`. | S | — | - |

---

## Suggested Build Order

1. **Week 1–2 (Foundation):** P1-1 through P1-16 — **complete.** Goal met: `/health` live on ECS, full local dev stack running.
2. **Week 3–4 (Ingestion):** P2-1 through P2-15. Goal: 3 documents ingested, corpus queryable in Postgres.
3. **Week 5 (Retrieval):** P3-1 through P3-9. Goal: `/retrieve` returning reranked chunks, manual eval complete.
4. **Week 6 (Generation):** P4-1 through P4-9. Goal: `/query` returning grounded cited answers.
5. **Week 7 (Frontend):** P5-1 through P5-12. Goal: live Vercel demo end-to-end.
6. **Week 8 (Eval + Polish):** P6-1 through P6-9 + INFRA tasks. Goal: benchmark done, README complete, repo public.

**MVP shortcut (if time is limited):** Complete P1 → P2 → P3-1/P3-2/P3-5/P3-6 (skip BM25 + RRF) → P4 → P5. Ship working demo first. Add BM25, RRF, evaluation, and polish afterward.
