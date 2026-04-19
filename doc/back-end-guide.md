# Back-End Developer Guide (FastAPI)

This guide helps developers work in the `app/` folder: project structure, how to add new modules, request pipeline, and where to implement each feature. For task lists and acceptance criteria, see [developer-tasks.md](developer-tasks.md).

---

## 1. Ports and URLs

| App | Port | Base URL | Docs |
|----|------|---------|------|
| Backend API | 8000 | `http://localhost:8000` | `http://localhost:8000/docs` |
| Frontend | 3000 | `http://localhost:3000` | — |
| Local Postgres | 5432 | `postgresql://localhost:5432/copilot` | — |
| Local Redis | 6379 | `redis://localhost:6379` | — |
| Local SQS (ElasticMQ) | 9324 | `http://localhost:9324` | — |

All API routes are prefixed at the root. The frontend calls `http://localhost:8000/...` in development and the ALB URL in production.

---

## 2. Project Structure

```
app/
├── main.py               # FastAPI app factory: middleware, routes, startup
├── core/
│   ├── config.py         # Settings (pydantic-settings, reads from env)
│   ├── logging.py        # Structured JSON logging middleware
│   └── exceptions.py     # Global exception handlers
├── db/
│   ├── session.py        # Async database session (asyncpg / SQLAlchemy async)
│   └── models.py         # SQLAlchemy ORM models (Document, DocumentChunk)
├── api/
│   ├── health.py         # GET /health
│   ├── ingest.py         # POST /ingest, GET /ingest/{id}
│   ├── retrieve.py       # POST /retrieve
│   └── query.py          # POST /query
├── ingestion/
│   ├── worker.py         # SQS polling loop (runs as separate ECS task)
│   ├── chunker.py        # RecursiveCharacterTextSplitter wrapper
│   ├── embedder.py       # OpenAI batch embedding with retry
│   └── parsers/
│       ├── sec_parser.py      # SEC 10-K/10-Q HTML parser
│       ├── transcript_parser.py # Earnings call transcript parser
│       └── pdf_parser.py      # PDF parser (pdfplumber)
├── retrieval/
│   ├── pipeline.py       # Orchestrates full retrieval flow
│   ├── query_embedder.py # Embed query + Redis cache
│   ├── vector_search.py  # pgvector cosine similarity search
│   ├── bm25_search.py    # PostgreSQL tsvector + ts_rank
│   ├── fusion.py         # Reciprocal Rank Fusion (RRF)
│   └── reranker.py       # Cohere Rerank API
├── generation/
│   ├── context_builder.py    # Format chunks as numbered context blocks
│   ├── classifier.py         # Query type classification (heuristic)
│   ├── llm.py                # Anthropic API call
│   ├── citation_parser.py    # Extract + validate citation indices
│   └── prompts/
│       └── system_prompt.txt # LLM system prompt
└── models/
    ├── requests.py       # Pydantic request models
    └── responses.py      # Pydantic response models

alembic/                  # Database migrations
scripts/
├── seed_corpus.py        # Upload + trigger ingestion for sample documents
├── seed_local.py         # Local dev seed (downloads + ingests sample docs)
└── check_corpus.py       # Validate corpus: chunk counts, embedding dims

tests/
├── test_retrieval.py
├── test_generation.py
└── test_ingestion.py

Dockerfile
docker-compose.yml
requirements.txt
.env.example
```

---

## 3. Request Pipeline

Every API request goes through this order. Understand this when adding auth, rate limiting, or new logging.

| Order | Layer | What runs | Example in this project |
|-------|-------|-----------|------------------------|
| 1 | **Middleware** | Runs before route handler; assigns `request_id`, logs incoming request | `LoggingMiddleware` in `app/core/logging.py` |
| 2 | **Route handler** | FastAPI runs the matching `@app.post(...)` function | `app/api/query.py` |
| 3 | **Pydantic validation** | Request body is validated automatically against the Pydantic model | `QueryRequest` in `app/models/requests.py` |
| 4 | **Service layer** | Route handler calls retrieval pipeline, generation, etc. | `retrieval.pipeline.retrieve(...)` |
| 5 | **Response** | Pydantic response model serializes the output | `QueryResponse` in `app/models/responses.py` |
| 6 | **Middleware (response)** | Logs status code + duration | `LoggingMiddleware` |

**Log output per request:**
```json
{"request_id": "abc123", "method": "POST", "path": "/query", "status_code": 200, "duration_ms": 2188}
```

---

## 4. Key Files

| File | Purpose |
|------|---------|
| `app/main.py` | App factory: adds middleware, includes routers, runs startup events |
| `app/core/config.py` | All env vars via `pydantic-settings`. Import `settings` anywhere. |
| `app/db/session.py` | Async DB session factory. Use `async with get_session() as session`. |
| `app/db/models.py` | SQLAlchemy ORM models for `documents` and `document_chunks`. |
| `app/ingestion/worker.py` | Entry point for the SQS polling worker (separate ECS task). |
| `docker-compose.yml` | Local dev: Postgres + pgvector, Redis, ElasticMQ (local SQS). |
| `.env.example` | Template for `.env`. Copy to `.env` and fill in real values. |
| `alembic/versions/` | Migration files. Never edit manually; use `alembic revision`. |

---

## 5. Adding a New API Route

### Step 1: Create the route file

Create `app/api/<feature>.py`:

```python
from fastapi import APIRouter, Depends
from app.models.requests import MyRequest
from app.models.responses import MyResponse

router = APIRouter()

@router.post("/my-endpoint", response_model=MyResponse)
async def my_endpoint(body: MyRequest) -> MyResponse:
    # call service layer here
    return MyResponse(...)
```

### Step 2: Register in main.py

```python
from app.api.my_feature import router as my_router
app.include_router(my_router)
```

### Step 3: Add Pydantic models

Add request/response models in `app/models/requests.py` and `app/models/responses.py`. FastAPI validates automatically.

### Step 4: Write tests

Add `tests/test_my_feature.py` using `httpx.AsyncClient` with the FastAPI test client.

---

## 6. Where to Implement What (by phase)

| Phase | Module(s) | Tasks |
|-------|----------|-------|
| P1 — Infrastructure | `app/main.py`, `app/core/`, `app/db/` | FastAPI skeleton, logging, DB session |
| P2 — Ingestion | `app/ingestion/`, `app/api/ingest.py` | Parsers, chunker, embedder, worker loop |
| P3 — Retrieval | `app/retrieval/` | Query embedder, vector search, BM25, RRF, reranker |
| P4 — Generation | `app/generation/`, `app/api/query.py` | Context builder, LLM, citation parser, /query endpoint |
| P5 — Frontend | N/A (frontend repo) | CORS config in `app/main.py` is the only backend change |
| P6 — Evaluation | `eval/` scripts | Retrieval eval, generation eval, improvement iteration |

---

## 7. Environment Variables

All env vars are managed via `app/core/config.py` using `pydantic-settings`. In production they come from AWS Secrets Manager (injected as container env vars by ECS). In development they come from `.env`.

Copy `.env.example` to `.env` and fill in:

```bash
# Database
DB_URL=postgresql+asyncpg://postgres:password@localhost:5432/copilot

# Redis
REDIS_URL=redis://localhost:6379

# AWS
AWS_REGION=us-east-1
SQS_QUEUE_URL=http://localhost:9324/000000000000/ingestion-queue
S3_BUCKET=financial-copilot-raw-docs

# AI APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
COHERE_API_KEY=...

# App
APP_ENV=development  # or production
LOG_LEVEL=INFO
```

**Never commit `.env` to git.** It is in `.gitignore`. Only `.env.example` (with placeholder values) is committed.

---

## 8. Running the Back-End Locally

```bash
# Start dependencies (Postgres, Redis, local SQS)
docker compose up -d

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start API server (with hot reload)
uvicorn app.main:app --reload --port 8000

# In a separate terminal: start ingestion worker
python -m app.ingestion.worker

# Seed local corpus (downloads + ingests 3 sample documents)
python scripts/seed_local.py
```

API will be available at `http://localhost:8000`.  
Auto-generated API docs at `http://localhost:8000/docs`.

---

## 9. Testing API Endpoints in Swagger

To test protected or complex endpoints via Swagger UI at `http://localhost:8000/docs`:

**Test `/query`:**
```json
{
  "question": "What are Apple's key risk factors in 2024?",
  "filters": {
    "companies": ["AAPL"],
    "years": [2024],
    "doc_types": ["10-K"]
  }
}
```

**Test `/retrieve`:**
```json
{
  "query": "Apple margin drivers Q3 2024",
  "filters": {
    "companies": ["AAPL"],
    "years": [2024]
  }
}
```

**Test `/ingest`:**
```json
{
  "s3_key": "filings/AAPL/10-K/2023.html",
  "company_ticker": "AAPL",
  "doc_type": "10-K",
  "year": 2023,
  "quarter": null,
  "source_url": "https://www.sec.gov/..."
}
```

If you get a 422, check the request body against the Pydantic model. If you get a 500, check CloudWatch logs for the structured error JSON.

---

## 10. Common Pitfalls

**Embeddings dimension mismatch:** Always use `text-embedding-3-small` for both ingestion and query. Never switch embedding models mid-corpus without re-embedding all chunks.

**pgvector not enabled:** Run `CREATE EXTENSION IF NOT EXISTS vector;` on any new RDS instance before running migrations.

**SQS message not deleted on success:** Always delete the SQS message after successful processing. If not deleted, the same document will be re-ingested after the visibility timeout.

**Async database session leak:** Always use `async with get_session() as session:` in a context manager. Never reuse sessions across requests.

**Cohere token limit:** Truncate chunk text to 512 tokens before passing to the reranker. Cohere Rerank has a per-document token limit; exceeding it causes silent truncation or errors.
