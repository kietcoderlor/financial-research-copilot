# Knowledge & Tech Stack Guide

A **beginner-focused** guide to each technology used in Financial Research Copilot. For each technology we explain what it is, why we use it here, and where to learn more.

**Use this doc when:** you are new to a tool, need a quick refresher, or want official docs and tutorials to go deeper.

**Reading path:**
- Backend work → Python, FastAPI, PostgreSQL, pgvector, then AWS (S3, SQS, ECS), then AI (OpenAI embeddings, Cohere, Anthropic).
- Frontend work → TypeScript, Next.js, Tailwind CSS, then API integration.
- AI/retrieval work → embeddings, pgvector, BM25, RRF, reranking, RAG patterns.
- DevOps → Docker, GitHub Actions, AWS ECS/Fargate, CloudWatch.

---

## 1. Language & Runtime

### Python

**What it is:** A general-purpose programming language widely used for AI, data engineering, and backend services. We use Python 3.11+.

**Why we use it:** The entire AI stack (Anthropic SDK, OpenAI SDK, Cohere SDK, pgvector client, LangChain text splitter) is Python-native. Using another language would require subprocess wrappers or separate microservices.

**References:**
- [Python official docs](https://docs.python.org/3/)
- [Python for beginners](https://www.python.org/about/gettingstarted/)

---

### TypeScript

**What it is:** A typed superset of JavaScript. You write `.ts` / `.tsx` files; they compile to `.js`. Types catch bugs early and improve editor support.

**Why we use it:** The frontend (Next.js) uses TypeScript for safer refactoring and clearer API contracts between components and the backend.

**References:**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)

---

## 2. Backend

### FastAPI

**What it is:** A modern, async Python web framework for building REST APIs. It uses Python type hints and Pydantic for automatic request/response validation and generates OpenAPI docs out of the box.

**Why we use it:** FastAPI is the de facto standard for AI backend services. It handles concurrent async I/O (embedding calls, vector search, LLM API) efficiently, and Pydantic validation keeps financial data (company tickers, date ranges) type-safe.

**Beginner focus:**
- `@app.get("/path")` and `@app.post("/path")` define routes.
- Pydantic models define the shape of request bodies and responses — FastAPI validates automatically.
- `async def` route handlers run concurrently; use `await` for async calls.
- `uvicorn` is the ASGI server that runs the FastAPI app.

**References:**
- [FastAPI official docs](https://fastapi.tiangolo.com/)
- [FastAPI tutorial](https://fastapi.tiangolo.com/tutorial/)

---

### Pydantic

**What it is:** A Python library for data validation using type annotations. FastAPI uses it under the hood.

**Why we use it:** Every API request body and response object is a Pydantic model. If a request comes in with a missing field or wrong type, FastAPI returns a 422 automatically.

**References:**
- [Pydantic docs](https://docs.pydantic.dev/latest/)

---

### Alembic

**What it is:** A database migration tool for SQLAlchemy (Python ORM). It tracks schema changes as versioned migration files.

**Why we use it:** When we add a column or create a new table (e.g., adding `token_count` to `document_chunks`), we write an Alembic migration instead of running raw SQL manually. This keeps schema in version control.

**Key commands:**
```bash
alembic revision --autogenerate -m "add token_count column"
alembic upgrade head        # run pending migrations
alembic downgrade -1        # roll back one migration
```

**References:**
- [Alembic docs](https://alembic.sqlalchemy.org/en/latest/)

---

## 3. Data & Persistence

### PostgreSQL

**What it is:** A production-grade open-source relational database. Data is stored in tables with rows and columns. SQL is used to query and modify data.

**Why we use it:** We store document metadata (`documents` table), chunk text, embeddings, and BM25 indexes (`document_chunks` table) all in one place. PostgreSQL with the pgvector extension is the foundation of our hybrid retrieval system.

**Beginner focus:**
- **Database → tables → rows.** One "record" is one row.
- `SELECT`, `INSERT`, `UPDATE`, `DELETE` are the core SQL operations.
- We use `asyncpg` (async PostgreSQL driver) from Python.

**References:**
- [PostgreSQL docs](https://www.postgresql.org/docs/)
- [PostgreSQL tutorial](https://www.postgresqltutorial.com/)

---

### pgvector

**What it is:** A PostgreSQL extension that adds a `vector` data type and enables fast approximate nearest-neighbor search directly in SQL.

**Why we use it:** Each document chunk is stored with an `embedding vector(1536)` column. At query time, we find similar chunks using cosine distance: `embedding <=> $query_vec`. This runs in the same database as our metadata, so we can combine vector search with SQL filters (`WHERE company_ticker = 'AAPL' AND year = 2024`) in a single query.

**Key concepts:**
- **HNSW index:** Fast approximate nearest-neighbor index. Created with `CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops)`.
- **Cosine distance operator:** `<=>` returns the cosine distance between two vectors (0 = identical, 2 = opposite).

**References:**
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [NeonDB pgvector guide](https://neon.tech/docs/extensions/pgvector)

---

### Redis (ElastiCache Serverless)

**What it is:** An in-memory key-value store used for caching. Data is stored in RAM, so reads are extremely fast (< 5ms).

**Why we use it:** We cache two things: (1) query results, keyed on `sha256(question + filters)` with a 24h TTL, and (2) query embeddings, keyed on `sha256(query)` with a 1h TTL. Cached queries respond in under 50ms instead of 2–3 seconds.

**Beginner focus:**
- `SET key value EX 86400` stores a key with a 24-hour TTL.
- `GET key` retrieves a value (returns `nil` if expired or missing).
- We use `redis.asyncio` for async access from FastAPI.

**References:**
- [Redis docs](https://redis.io/docs/)
- [AWS ElastiCache Serverless](https://aws.amazon.com/elasticache/serverless/)

---

## 4. AI / Retrieval

### Embeddings (OpenAI `text-embedding-3-small`)

**What it is:** A model that converts text into a dense vector of numbers (1536 dimensions). Semantically similar texts have vectors that are close together in vector space.

**Why we use it:** We embed every document chunk at ingestion time and embed the user's query at retrieval time. Then we find the most similar chunks using cosine distance in pgvector.

**Beginner focus:**
- An embedding is just a list of 1536 floats: `[0.023, -0.104, 0.891, ...]`.
- Cosine similarity measures the angle between two vectors. Score of 1.0 = identical meaning.
- We call `openai.embeddings.create(model="text-embedding-3-small", input=[text])` in batches of 100.

**References:**
- [OpenAI embeddings docs](https://platform.openai.com/docs/guides/embeddings)

---

### BM25 / Full-Text Search (PostgreSQL tsvector)

**What it is:** BM25 is a ranking algorithm for keyword-based search (the same algorithm used by Elasticsearch and Google for exact-match ranking). PostgreSQL implements it natively via the `tsvector` type and `ts_rank` function.

**Why we use it:** Vector search finds semantically similar text but can miss exact financial terms ("EBITDA margin", "free cash flow", ticker symbols). BM25 catches these precise matches. Combining both with RRF gives better retrieval than either alone.

**Key SQL pattern:**
```sql
SELECT *, ts_rank(tsv, plainto_tsquery('english', $query)) AS rank
FROM document_chunks
WHERE tsv @@ plainto_tsquery('english', $query)
  AND company_ticker = 'AAPL'
ORDER BY rank DESC
LIMIT 20;
```

**References:**
- [PostgreSQL full-text search](https://www.postgresql.org/docs/current/textsearch.html)

---

### Reciprocal Rank Fusion (RRF)

**What it is:** A simple algorithm that merges two ranked lists (e.g., vector search results and BM25 results) into a single unified ranking without needing to tune weights.

**Formula:** `score = sum(1 / (k + rank))` for each list, where `k = 60`. A chunk appearing near the top of both lists gets a higher fused score.

**Why we use it:** We don't have labeled training data to learn optimal fusion weights. RRF is parameter-free and works well in practice as a first-pass fusion method.

**References:**
- [RRF paper (Cormack et al.)](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)

---

### Cohere Reranker

**What it is:** A cross-encoder model that scores the relevance of a (query, document) pair directly. Unlike bi-encoder embeddings (which embed query and document separately), a cross-encoder reads both together, giving more accurate relevance scores.

**Why we use it:** Vector cosine distance measures semantic similarity, not query relevance. A chunk about "Apple risk factors in 2018" may have high cosine similarity with a query about "Apple risk factors in 2024." The reranker catches this by considering the full context of both query and chunk.

**How we call it:**
```python
cohere.rerank(
    model="rerank-v3.5",
    query=query,
    documents=[c.chunk_text for c in candidates],
    top_n=5
)
```

**References:**
- [Cohere Rerank docs](https://docs.cohere.com/reference/rerank)

---

### LangChain Text Splitter

**What it is:** A utility for splitting long documents into smaller chunks. We use `RecursiveCharacterTextSplitter` from the `langchain` library.

**Why we use it:** LLMs and embedding models have token limits. We split each document into chunks of 512 tokens with 50-token overlap (so context at chunk boundaries isn't lost). Chunks are sized using `tiktoken` (same tokenizer as OpenAI models).

**References:**
- [LangChain text splitters](https://python.langchain.com/docs/modules/data_connection/document_transformers/)

---

### Anthropic Claude (LLM)

**What it is:** A large language model API by Anthropic. We use Claude 3.5 Sonnet for answer generation and Claude 3 Haiku for cheap classification tasks.

**Why we use it:** Claude 3.5 Sonnet has a 200K token context window (vs GPT-4o's 128K), which is important for financial documents. It also performs well on structured synthesis (comparison tables, bull/bear cases).

**Key usage pattern:**
```python
anthropic.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=2048,
    system=system_prompt,
    messages=[{"role": "user", "content": user_message}]
)
```

**References:**
- [Anthropic API docs](https://docs.anthropic.com/)
- [Claude models overview](https://docs.anthropic.com/en/docs/about-claude/models)

---

## 5. Document Parsing

### sec-edgar-downloader

**What it is:** A Python library that downloads SEC filings (10-K, 10-Q) by ticker and year from EDGAR.

**Why we use it:** EDGAR is the public SEC filing database. This library handles the API requests and file downloads cleanly.

**References:**
- [sec-edgar-downloader GitHub](https://github.com/jadchaar/sec-edgar-downloader)

---

### BeautifulSoup4

**What it is:** A Python library for parsing HTML and XML. We use it to extract clean text from SEC HTML filings.

**Why we use it:** SEC 10-K/10-Q filings are available as HTML. We strip headers, footers, navigation, and boilerplate to extract plain readable text before chunking.

**References:**
- [BeautifulSoup docs](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)

---

### pdfplumber

**What it is:** A Python library for extracting text from PDF files. Handles multi-column layouts better than basic PDF readers.

**Why we use it:** Shareholder letters are typically PDFs. `pdfplumber` extracts text page by page with reasonable handling of formatting.

**References:**
- [pdfplumber GitHub](https://github.com/jsvine/pdfplumber)

---

## 6. Frontend

### Next.js

**What it is:** A React framework with file-based routing, server-side rendering (SSR), and App Router. The frontend standard at most AI product companies (Perplexity, Notion, Linear).

**Why we use it:** The demo UI needs a filter panel, citation display, and potentially multi-turn conversation later. Next.js App Router handles these patterns cleanly. Vercel deployment is free and zero-config.

**Beginner focus:**
- **App Router:** Files in `app/` define routes. `app/page.tsx` = the home route `/`.
- **Server Components vs Client Components:** Use `"use client"` for components that need state or browser APIs.
- **`lib/apiClient.ts`:** Our wrapper around `fetch` calls to the FastAPI backend.

**References:**
- [Next.js docs](https://nextjs.org/docs)
- [Next.js App Router tutorial](https://nextjs.org/learn)

---

### Tailwind CSS

**What it is:** A utility-first CSS framework. Style elements by adding classes (`flex`, `p-4`, `text-blue-600`) instead of writing separate CSS files.

**Why we use it:** Fast to prototype and keeps styles consistent across components.

**References:**
- [Tailwind CSS docs](https://tailwindcss.com/docs)

---

### react-markdown

**What it is:** A React component that renders Markdown text as HTML.

**Why we use it:** The LLM returns answers in Markdown format (headers, bullet points, bold text). `react-markdown` renders this correctly in the `AnswerDisplay` component.

**References:**
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown)

---

## 7. AWS Services

### AWS S3

**What it is:** Object storage. You store and retrieve files (objects) by key (like a file path). Highly durable and cheap.

**Why we use it:** Raw documents (PDFs, HTML filings) are stored in S3 before ingestion. The ingestion worker downloads from S3 to `/tmp/` for processing.

**References:**
- [S3 getting started](https://docs.aws.amazon.com/AmazonS3/latest/userguide/GetStartedWithS3.html)

---

### AWS SQS

**What it is:** A fully managed message queue. Producers put messages on the queue; consumers poll and process them. Messages are retried automatically if processing fails.

**Why we use it:** Document ingestion takes 2–5 minutes (parsing, chunking, 500 embedding API calls). SQS decouples the API (which triggers ingestion) from the worker (which runs it). If the worker crashes, the message stays in the queue and is retried.

**Key concepts:**
- **Visibility timeout:** How long a message is hidden after a consumer picks it up (we set 600s).
- **Dead Letter Queue (DLQ):** After 3 failed receives, the message is moved to the DLQ for inspection.

**References:**
- [SQS developer guide](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/)

---

### AWS ECS + Fargate

**What it is:** ECS (Elastic Container Service) runs Docker containers on AWS. Fargate is the serverless compute engine — you don't manage the underlying EC2 instances.

**Why we use it:** We run two long-running containers: the FastAPI API server and the ingestion worker. Fargate starts them, keeps them running, and restarts on failure. No server patching, no instance management.

**Beginner focus:**
- **Task definition:** Describes the container (image from ECR, CPU/memory, env vars from Secrets Manager).
- **Service:** Keeps a desired number of tasks running (we use 1 for each).
- **ALB:** Application Load Balancer in the public subnet routes HTTPS traffic to the ECS service.

**References:**
- [ECS getting started](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/getting-started.html)
- [Fargate overview](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)

---

### AWS RDS

**What it is:** Managed relational database service. We use RDS PostgreSQL 15 with the pgvector extension.

**Why we use it:** Managed means AWS handles backups, patching, failover, and storage scaling. We just connect and run queries.

**References:**
- [RDS PostgreSQL docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)

---

### AWS CloudWatch

**What it is:** AWS logging and monitoring service. ECS containers ship logs to CloudWatch automatically. We use CloudWatch Logs Insights to query structured JSON logs.

**Why we use it:** We emit one structured JSON log per request with latency breakdown, query, filters, token count, chunk counts. CloudWatch Insights lets us compute p50/p95 latency, find slow queries, and track LLM cost.

**References:**
- [CloudWatch Logs Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)

---

### AWS Secrets Manager

**What it is:** Secure storage for credentials (API keys, database URLs). ECS tasks retrieve secrets at startup via IAM roles.

**Why we use it:** No credentials in Docker images or GitHub. All secrets (`DB_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `COHERE_API_KEY`, etc.) live in Secrets Manager.

**References:**
- [Secrets Manager docs](https://docs.aws.amazon.com/secretsmanager/latest/userguide/)

---

## 8. DevOps Tools

### Docker

**What it is:** Containers package the app and its environment so it runs the same everywhere. We write a `Dockerfile` that describes the image; Docker builds it.

**Why we use it:** Both the FastAPI server and ingestion worker run from the same Docker image pushed to ECR. ECS/Fargate pulls the image and runs it.

**Beginner focus:**
- **Image:** Blueprint (Python 3.11 + our app).
- **Container:** Running instance of an image.
- **Dockerfile:** Instructions to build the image.
- `docker build -t app .` → `docker run app` locally.

**References:**
- [Docker getting started](https://docs.docker.com/get-started/)

---

### Docker Compose

**What it is:** A tool to define and run multi-container local development environments. We use it to run Postgres (with pgvector), Redis, and a local SQS mock (ElasticMQ) together.

**Why we use it:** Iterating against real AWS on every code change is slow and costs money. `docker compose up` gives you the full local stack in seconds.

**References:**
- [Docker Compose overview](https://docs.docker.com/compose/)

---

### GitHub Actions

**What it is:** CI/CD automation built into GitHub. On push to `main`, our workflow builds the Docker image, pushes to ECR, and forces a new ECS deployment.

**Why we use it:** Automates deployment so every merge to `main` is automatically live on AWS.

**References:**
- [GitHub Actions docs](https://docs.github.com/en/actions)

---

### Git

**What it is:** Version control. Track changes, branches, and history.

**Why we use it:** All code is in Git. Follow the rules in [git-rules.md](git-rules.md) (branches, commits, PRs).

**References:**
- [Git documentation](https://git-scm.com/doc)
- [Git Book (free)](https://git-scm.com/book/en/v2)

---

## 9. Quick Reference Table

| Area | Technology | Official link |
|-----|-----------|--------------|
| Language | Python 3.11+ | https://docs.python.org/3/ |
| Backend | FastAPI | https://fastapi.tiangolo.com/ |
| Validation | Pydantic | https://docs.pydantic.dev/ |
| DB migrations | Alembic | https://alembic.sqlalchemy.org/ |
| Database | PostgreSQL | https://www.postgresql.org/docs/ |
| Vector search | pgvector | https://github.com/pgvector/pgvector |
| Cache | Redis | https://redis.io/docs/ |
| Embeddings | OpenAI API | https://platform.openai.com/docs/guides/embeddings |
| Reranker | Cohere | https://docs.cohere.com/reference/rerank |
| LLM | Anthropic | https://docs.anthropic.com/ |
| Text splitter | LangChain | https://python.langchain.com/ |
| SEC filing parser | sec-edgar-downloader | https://github.com/jadchaar/sec-edgar-downloader |
| PDF parser | pdfplumber | https://github.com/jsvine/pdfplumber |
| HTML parser | BeautifulSoup4 | https://www.crummy.com/software/BeautifulSoup/bs4/doc/ |
| Frontend | Next.js | https://nextjs.org/docs |
| Styling | Tailwind CSS | https://tailwindcss.com/docs |
| Storage | AWS S3 | https://docs.aws.amazon.com/s3/ |
| Queue | AWS SQS | https://docs.aws.amazon.com/sqs/ |
| Deployment | AWS ECS/Fargate | https://docs.aws.amazon.com/ecs/ |
| Database hosting | AWS RDS | https://docs.aws.amazon.com/rds/ |
| Logging | AWS CloudWatch | https://docs.aws.amazon.com/cloudwatch/ |
| Secrets | AWS Secrets Manager | https://docs.aws.amazon.com/secretsmanager/ |
| Containers | Docker | https://docs.docker.com/ |
| CI/CD | GitHub Actions | https://docs.github.com/en/actions |
