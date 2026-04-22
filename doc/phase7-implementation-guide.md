# Phase 7 Implementation Guide

This document explains *how* to implement the highest-priority Phase 7 tasks — the ones that are technically non-obvious and where Claude Code benefits from architectural context before writing code. Read alongside [phase7-developer-tasks.md](phase7-developer-tasks.md) and [high-level-architecture.md](high-level-architecture.md).

---

## 1. Scope of This Guide

This guide covers implementation details for:

- **P7-A1** — Corpus expansion to 50+ companies
- **P7-A2** — Redis query cache
- **P7-A3** — HNSW index migration and benchmarking
- **P7-A4** — Load testing methodology
- **P7-B1** — Query router / classifier
- **P7-B2** — Streaming response via SSE
- **P7-B4** — Hallucination detection
- **P7-B5** — LLM-as-judge evaluation (**new**)
- **P7-B7** — Semantic cache (**new**)

Other Phase 7 tasks are straightforward enough that the task description in `phase7-developer-tasks.md` is sufficient.

---

## 2. P7-A1: Corpus Expansion

### 2.1 Goal

Grow the corpus from ~3 documents to 300+ documents covering 30–50 companies. This fixes the primary cause of the "arbitrary query returns nothing" bug and unlocks meaningful benchmarks.

### 2.2 Ticker Selection Strategy

Pick ~40 tickers balancing sectors so demo queries don't always hit tech:

- **Tech (10):** AAPL, MSFT, GOOGL, META, NVDA, AMZN, TSLA, NFLX, CRM, ORCL
- **Finance (8):** JPM, BAC, GS, MS, BRK.B, V, MA, WFC
- **Healthcare (6):** JNJ, UNH, PFE, LLY, MRK, ABBV
- **Consumer (6):** WMT, COST, PG, KO, MCD, NKE
- **Energy (4):** XOM, CVX, COP, SLB
- **Industrial (4):** CAT, BA, GE, UPS
- **Telecom/Media (2):** DIS, T

Store in `data/sp500_subset.csv` with columns `ticker,name,sector`.

### 2.3 Document Targets per Company

Per ticker, fetch:
- Latest 10-K (most recent annual filing)
- Latest two 10-Q (quarterly filings)
- Optionally: one earnings transcript per ticker (from Kaggle dataset) for 10 well-known companies

Target: ~40 × 3 = 120 SEC filings + 10 transcripts ≈ 130 documents. At ~500 chunks each, that's ~65,000 chunks. Embedding cost: ~$0.60. Storage: ~1.5GB on RDS (well within `db.t3.micro` 20GB).

### 2.4 Script: `scripts/bulk_ingest_sp500.py`

```python
import csv
import time
import logging
from pathlib import Path
from sec_edgar_downloader import Downloader
import httpx

logger = logging.getLogger(__name__)
API_BASE = "https://<alb-dns>"
SEC_RATE_LIMIT_SLEEP = 0.12  # 10 req/sec = 0.1s; add buffer

def main():
    tickers = load_tickers("data/sp500_subset.csv")
    dl = Downloader("FinancialCopilot", "you@example.com", "/tmp/filings")
    
    for row in tickers:
        ticker = row["ticker"]
        try:
            dl.get("10-K", ticker, limit=1)
            time.sleep(SEC_RATE_LIMIT_SLEEP)
            dl.get("10-Q", ticker, limit=2)
            time.sleep(SEC_RATE_LIMIT_SLEEP)
            
            for filing_path in find_downloaded_files(ticker):
                s3_key = upload_to_s3(filing_path, ticker)
                enqueue_ingestion(s3_key, ticker, row)
            
        except Exception as e:
            logger.error(f"Failed for {ticker}: {e}")
            continue

def enqueue_ingestion(s3_key, ticker, row):
    resp = httpx.post(f"{API_BASE}/ingest", json={
        "s3_key": s3_key,
        "company_ticker": ticker,
        "company_name": row["name"],
        "doc_type": infer_doc_type(s3_key),
        "year": extract_year(s3_key),
        "quarter": extract_quarter(s3_key),
    }, timeout=30)
    resp.raise_for_status()
```

### 2.5 Running Safely Against Production

- Run during off-hours.
- Monitor SQS queue depth in CloudWatch — ensure workers keep up (this drives P7-A5 autoscaling requirement).
- Monitor OpenAI API rate limits. `text-embedding-3-small` allows 3000 RPM on tier 1; batch of 100 per call → 30 RPM. Safe.
- Monitor ingestion DLQ. Anything in DLQ after the run is a real parsing bug to investigate.

### 2.6 Verification

```sql
SELECT COUNT(*) AS total_chunks FROM document_chunks;
SELECT company_ticker, doc_type, COUNT(*) AS chunks
FROM document_chunks GROUP BY 1, 2 ORDER BY 1, 2;
```

Expect ~40 tickers, ~5000+ total chunks.

---

## 3. P7-A2: Redis Query Cache

### 3.1 Design

Read-through cache in front of `/query` and `/retrieve`. Cache invalidation is time-based (TTL) only — the corpus changes slowly, so 1-hour staleness is acceptable.

### 3.2 Cache Key Design

Key = `sha256(json.dumps({"endpoint": "query", "q": normalized_q, "filters": sorted_filters}))[:32]`

Where `normalized_q`:
- Lowercase
- Strip leading/trailing whitespace
- Collapse multiple spaces to one

And `sorted_filters` is the filter dict with keys sorted alphabetically and list values sorted, so `{"tickers": ["MSFT", "AAPL"]}` and `{"tickers": ["AAPL", "MSFT"]}` hash identically.

Namespace: prefix all keys with `qcache:v1:` so invalidation (bumping to `v2`) is trivial if cache format changes.

### 3.3 Implementation Location

Create `app/core/cache.py`:

```python
import hashlib
import json
from typing import Optional, Any
import redis.asyncio as aioredis

CACHE_VERSION = "v1"
DEFAULT_TTL = 3600

class QueryCache:
    def __init__(self, redis_client: aioredis.Redis, ttl: int = DEFAULT_TTL):
        self.redis = redis_client
        self.ttl = ttl

    def _key(self, endpoint: str, query: str, filters: dict) -> str:
        normalized_q = " ".join(query.lower().strip().split())
        payload = {"endpoint": endpoint, "q": normalized_q, "filters": self._sort(filters)}
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:32]
        return f"qcache:{CACHE_VERSION}:{digest}"

    def _sort(self, filters: dict) -> dict:
        return {k: sorted(v) if isinstance(v, list) else v for k, v in sorted(filters.items())}

    async def get(self, endpoint: str, query: str, filters: dict) -> Optional[Any]:
        key = self._key(endpoint, query, filters)
        raw = await self.redis.get(key)
        if raw:
            await emit_metric("cache_hit", endpoint=endpoint)
            return json.loads(raw)
        await emit_metric("cache_miss", endpoint=endpoint)
        return None

    async def set(self, endpoint: str, query: str, filters: dict, value: Any) -> None:
        key = self._key(endpoint, query, filters)
        await self.redis.setex(key, self.ttl, json.dumps(value, default=str))
```

### 3.4 What NOT to Cache

- `/ingest` — this mutates state.
- Streaming endpoint (`/query/stream` from P7-B2) — caching streamed responses is complex; skip.
- Responses where the generator returned an error or refusal.

### 3.5 Observability

Emit `cache_hit` and `cache_miss` CloudWatch metrics (dimension: endpoint). Derive `cache_hit_rate` in the dashboard widget (P7-A6).

### 3.6 Interview Talking Point

*"I added a Redis read-through cache with SHA-256 keys over normalized query + sorted filters. Hit rate on repeated demo queries is ~40%, cutting p95 for cached responses from 1.8s to 35ms. I chose TTL-based invalidation over write-invalidation because the corpus updates daily at most, so 1-hour staleness is an acceptable tradeoff for simpler code."*

---

## 4. P7-A3: HNSW Migration & Benchmark

### 4.1 Why HNSW

pgvector supports two ANN index types:
- **IVFFlat** — faster to build, slightly faster on small corpora, but recall degrades at scale.
- **HNSW** — slower to build, more memory, but higher recall and faster queries at scale. Recommended by pgvector maintainers for production.

At 65K chunks (post P7-A1), HNSW starts meaningfully outperforming IVFFlat. This is the threshold where the decision becomes defensible in an interview.

### 4.2 Migration

```python
def upgrade():
    op.execute("DROP INDEX IF EXISTS idx_chunks_embedding")
    op.execute("""
        CREATE INDEX idx_chunks_embedding 
        ON document_chunks 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    """)
```

Build time for 65K vectors: ~2–5 minutes. Run during off-hours — index build locks writes.

### 4.3 Benchmark Script

`scripts/benchmark_index.py`:

1. Pick 50 queries from `eval/questions.csv`.
2. Compute ground truth: brute-force cosine similarity against all chunks (no index).
3. With HNSW index active, run each query with `hnsw.ef_search ∈ {10, 40, 100}`.
4. Measure recall@10 vs ground truth and p50/p95 latency.
5. Repeat with IVFFlat on staging.
6. Write results table to `docs/benchmarks/hnsw-vs-ivfflat.md`.

Expected: HNSW with `ef_search=40` achieves recall@10 > 0.95 with p95 < IVFFlat p95. If not, investigate before trusting.

### 4.4 Deliverable

`docs/benchmarks/hnsw-vs-ivfflat.md`:
- Corpus size
- Index params for both
- Results table (recall@10, p50, p95)
- Decision and justification
- Caveats (methodology, environment)

Resume bullet: *"Benchmarked HNSW vs IVFFlat on 65K vectors; improved recall@10 from 0.91 to 0.96, reduced p95 from 180ms to 95ms."*

---

## 5. P7-A4: Load Testing

### 5.1 Tool

k6 is the right choice: JS test scripts, clean metrics, standalone runtime. Locust is fine if you prefer Python.

### 5.2 Query Mix

Don't hammer the same query 10000 times — that just tests the cache. Use a realistic sample:

```javascript
import { SharedArray } from 'k6/data';
const queries = new SharedArray('queries', () => JSON.parse(open('./test-queries.json')));

export default function () {
    const q = queries[Math.floor(Math.random() * queries.length)];
    const res = http.post(`${__ENV.API_URL}/query`, JSON.stringify({
        question: q.question, filters: q.filters
    }), { headers: { 'Content-Type': 'application/json' } });
    check(res, { 'status 200': (r) => r.status === 200 });
    sleep(Math.random() * 2 + 1);
}
```

`test-queries.json`: 30–50 queries sampled from `eval/questions.csv`.

### 5.3 Scenarios

```javascript
export const options = {
    scenarios: {
        baseline_10vu: { executor: 'constant-vus', vus: 10, duration: '2m', exec: 'default' },
        mid_50vu: { executor: 'constant-vus', vus: 50, duration: '2m', exec: 'default', startTime: '2m30s' },
        peak_100vu: { executor: 'constant-vus', vus: 100, duration: '2m', exec: 'default', startTime: '5m' },
    },
    thresholds: {
        http_req_duration: ['p(95)<2000'],
        http_req_failed: ['rate<0.01'],
    },
};
```

### 5.4 Metrics to Capture

- `http_req_duration{endpoint:/query}` — p50, p95, p99
- `http_req_failed` — error rate
- CloudWatch side: ECS CPU/mem, RDS CPU, Redis hit rate during test.

### 5.5 Bottleneck Checklist

If p95 exceeds target, check in order:
1. RDS CPU — if >80%, DB is bottleneck.
2. Connection pool exhaustion — SQLAlchemy pool metrics.
3. Embedding API latency — per-request OpenAI latency.
4. LLM API latency — Claude `/messages` dominant.
5. ECS task CPU — scale out tasks or up task size.

Document findings in `docs/benchmarks/load-test-baseline.md`. Re-run after P7-A2 + P7-A3 for before/after bullet.

---

## 6. P7-B1: Query Router

### 6.1 Classes

- `factual` — "What was Apple's Q3 2024 revenue?" → single-entity retrieve
- `comparison` — "Compare Apple vs Microsoft margins" → multi-hop retrieve (P7-B3)
- `synthesis` — "What's the bull case for TSLA?" → broader context, different prompt
- `adversarial` — prompt injection / out-of-scope → refuse

### 6.2 Two-Stage Approach

**Stage 1 — rules** (`app/retrieval/router.py`):

```python
COMPARISON_PATTERNS = [r"\bvs\.?\b", r"\bversus\b", r"\bcompare\b"]
SYNTHESIS_PATTERNS = [r"\bbull case\b", r"\bbear case\b", r"\bsummary\b"]
ADVERSARIAL_PATTERNS = [r"ignore.+instruction", r"system prompt", r"you are now"]

def rule_classify(query: str) -> Optional[QueryClass]:
    q = query.lower()
    if any(re.search(p, q) for p in ADVERSARIAL_PATTERNS): return QueryClass.ADVERSARIAL
    if any(re.search(p, q) for p in COMPARISON_PATTERNS): return QueryClass.COMPARISON
    if any(re.search(p, q) for p in SYNTHESIS_PATTERNS): return QueryClass.SYNTHESIS
    return None
```

**Stage 2 — Claude Haiku fallback** with JSON-mode prompt when rules don't match.

### 6.3 Cache + Route

Cache classifications in Redis (key: `router:{sha256(query)[:16]}`, TTL 86400).

```python
async def run_query_pipeline(req):
    cls = await router.classify(req.question)
    if cls == QueryClass.ADVERSARIAL: return REFUSAL_RESPONSE
    elif cls == QueryClass.COMPARISON: return await multi_hop_pipeline(req)
    elif cls == QueryClass.SYNTHESIS: return await synthesis_pipeline(req)
    else: return await factual_pipeline(req)
```

### 6.4 Evaluation

20 labeled queries in `eval/router_test.csv`. Target accuracy ≥85%.

---

## 7. P7-B2: Streaming Response (SSE)

### 7.1 Why Streaming

Current: user submits → 3–5s wait → full answer. Feels slow.
Streaming: first token <500ms. Feels instant.

### 7.2 Backend — FastAPI SSE

`app/api/query_stream.py`:

```python
from fastapi.responses import StreamingResponse
import json

@router.post("/query/stream")
async def query_stream(req: QueryRequest):
    async def event_generator():
        chunks = await retriever.retrieve(req.question, req.filters)
        yield f"event: sources\ndata: {json.dumps([c.to_dict() for c in chunks])}\n\n"
        
        async for token in generator.stream(req.question, chunks):
            yield f"event: token\ndata: {json.dumps({'text': token})}\n\n"
        
        yield f"event: done\ndata: {json.dumps({'citations': chunks})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

Anthropic SDK streaming:

```python
async with client.messages.stream(model="claude-sonnet-4-5", ...) as stream:
    async for text in stream.text_stream:
        yield text
```

### 7.3 Frontend — Next.js consumption

Use `fetch` + `ReadableStream` (not `EventSource` — it only supports GET):

```typescript
const res = await fetch(`${API_URL}/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, filters }),
});
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) handleSSEFrame(frame);
}
```

### 7.4 Metrics

Track `time_to_first_token` and `time_to_complete` in CloudWatch. First is your new hero metric.

---

## 8. P7-B4: Hallucination Detection

### 8.1 Simple Approach

Embed each sentence of the answer. For each, compute max cosine similarity to cited chunks. Flag sentences below threshold.

```python
def detect_hallucinations(answer: str, cited_chunks: list[Chunk], threshold: float = 0.72):
    sentences = split_sentences(answer)
    sent_embeddings = embed_batch(sentences)
    chunk_embeddings = [c.embedding for c in cited_chunks]
    
    flags = []
    for i, se in enumerate(sent_embeddings):
        max_sim = max(cosine(se, ce) for ce in chunk_embeddings)
        if max_sim < threshold:
            flags.append({"sentence": sentences[i], "max_similarity": max_sim})
    return flags
```

### 8.2 Threshold Calibration

Don't pick 0.72 arbitrarily. Run 20 manually-labeled (hallucination vs. not) examples, plot distribution, pick separating threshold.

### 8.3 What to Do With Flags

Start conservative: log only, track `hallucination_flag_rate` metric. Aggressive UI warnings risk false positives that undermine trust.

### 8.4 Evaluation

5 crafted test hallucinations (inject wrong numbers into grounded answers). Detector should flag each. pytest fixture.

---

## 9. P7-B5: LLM-as-Judge Evaluation

### 9.1 Why This Matters

Phase 6 eval is manual — you hand-label Precision@5 for every change. This bottlenecks iteration. Every time you tweak chunking, reranking, or prompts, you'd need to re-label. An LLM judge scales this 10x and runs in CI.

But LLM judges have known failure modes. The goal is not "replace humans" — it's "correlate well enough with humans that CI gating is reliable."

### 9.2 Architecture

Two judges, one per layer:

- **`judge_retrieval(query, chunks) → list[relevance_score]`** — per-chunk 1-5 score on whether the chunk answers the query.
- **`judge_generation(query, answer, cited_chunks) → {faithfulness, completeness, clarity}`** — per-answer 1-5 scores.

Both use Claude Opus (not Sonnet/Haiku) because judge quality matters more than cost here. Budget: ~$0.10 per 30-question benchmark run.

### 9.3 Prompt Template for Retrieval Judge

```python
RETRIEVAL_JUDGE_PROMPT = """You are evaluating whether a document chunk answers a financial research query.

Query: {query}

Chunk:
{chunk_text}

Metadata: {company_ticker} · {doc_type} · {year} · {section}

Rate relevance on a 1-5 scale:
5 = Directly answers the query with specific information
4 = Contains relevant information but not the exact answer
3 = Related topic, but doesn't address the query specifically
2 = Marginally related
1 = Not relevant

Return ONLY JSON: {{"score": <1-5>, "reasoning": "<one sentence>"}}
"""
```

### 9.4 Prompt Template for Generation Judge

```python
GENERATION_JUDGE_PROMPT = """You are evaluating an AI-generated financial research answer.

Query: {query}

Answer:
{answer}

Source chunks the answer cites:
{chunks_formatted}

Rate on three dimensions (1-5 each):

faithfulness: Does the answer stay within what the cited chunks actually support?
  5 = Every claim is directly supported; no unsupported inferences
  3 = Mostly supported; some mild extrapolation
  1 = Contains claims not supported by any chunk (hallucination)

completeness: Does the answer fully address the query?
  5 = Addresses all parts of the query with appropriate depth
  3 = Addresses main parts, misses nuance
  1 = Major aspects of query unaddressed

clarity: Is the answer well-structured and easy to understand?
  5 = Clear, concise, logical flow
  3 = Readable but some awkwardness
  1 = Confusing or incoherent

Return ONLY JSON:
{{"faithfulness": <1-5>, "completeness": <1-5>, "clarity": <1-5>, "reasoning": "<two sentences>"}}
"""
```

### 9.5 Implementation

`eval/llm_judge.py`:

```python
import json
import asyncio
from anthropic import AsyncAnthropic

client = AsyncAnthropic()

async def judge_retrieval(query: str, chunk: dict) -> int:
    resp = await client.messages.create(
        model="claude-opus-4-7",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": RETRIEVAL_JUDGE_PROMPT.format(query=query, chunk_text=chunk["text"], **chunk["metadata"])
        }]
    )
    result = json.loads(resp.content[0].text)
    return result["score"]

async def judge_retrieval_batch(query: str, chunks: list[dict]) -> list[int]:
    return await asyncio.gather(*[judge_retrieval(query, c) for c in chunks])
```

### 9.6 Calibration Against Human Labels

This is the most important step. Without calibration the judge is unvalidated.

**Process:**
1. Use the 50 chunk-level labels from P6-2 (where you hand-labeled top-5 for each question Relevant=1 / Not Relevant=0).
2. Convert human labels: treat relevance ≥ 4 from judge as Relevant (1), < 4 as Not Relevant (0).
3. Compute **Cohen's kappa** between human labels and judge labels.

```python
from sklearn.metrics import cohen_kappa_score

human_labels = load_human_labels()  # list[0 or 1]
judge_labels = [1 if s >= 4 else 0 for s in judge_scores]
kappa = cohen_kappa_score(human_labels, judge_labels)
```

Interpretation:
- κ > 0.8: judge is essentially equivalent to a second human annotator
- κ 0.6–0.8: acceptable, reasonable agreement
- κ < 0.6: judge is unreliable; iterate prompt

If kappa < 0.7: analyze disagreements (export to CSV, read 20), identify patterns, revise prompt. Common issues: judge too lenient on off-topic but well-written chunks, judge missing domain-specific relevance cues. Re-measure.

### 9.7 Known Biases to Guard Against

LLM judges have documented biases. Guard with:

- **Verbosity bias** — longer answers score higher unfairly. Mitigation: include explicit "length is not a quality signal" in prompt.
- **Position bias** — in pairwise comparisons, first option wins more often. Mitigation: use absolute scoring (1-5) not pairwise.
- **Self-preference** — judges favor their own model family's style. Mitigation: judge with different family than generator when possible. In this project generator is Claude Sonnet, judge is Claude Opus — same family, so document this caveat honestly.

### 9.8 Integration into CI and Full Eval

`eval/run_full_eval.py`:

```python
async def run_full_eval(questions_path: str, output_path: str):
    questions = load_questions(questions_path)
    results = []
    
    for q in questions:
        retrieve_resp = await api_post("/retrieve", q)
        retrieval_scores = await judge_retrieval_batch(q["question"], retrieve_resp["chunks"])
        
        query_resp = await api_post("/query", q)
        generation_scores = await judge_generation(q["question"], query_resp["answer"], query_resp["citations"])
        
        results.append({
            "question_id": q["id"],
            "precision_at_5": sum(1 for s in retrieval_scores[:5] if s >= 4) / 5,
            "faithfulness": generation_scores["faithfulness"],
            "completeness": generation_scores["completeness"],
            "clarity": generation_scores["clarity"],
        })
    
    save_results(results, output_path)
    return aggregate(results)
```

Target: 30 questions finish in <10 minutes, cost <$0.50/run.

### 9.9 Deliverable

`docs/eval/llm-judge-calibration.md`:
- Kappa score achieved (human vs judge)
- Sample disagreements analyzed
- Prompt iterations (v1 kappa → v2 kappa)
- Known limitations

Resume bullet: *"Automated eval pipeline with Claude Opus as judge; Cohen's kappa of 0.78 vs 50 human labels. Enables CI regression gating on Precision@5."*

Interview talking point: *"I automated evaluation because manual labeling blocked iteration. But I didn't just trust the LLM judge — I calibrated against 50 human labels first and reached kappa 0.78, which is in the range reported by Zheng et al. 2024 for LLM-as-judge. I documented known biases like verbosity preference and noted that my judge and generator are same-family, which is a validity concern I'd address with a cross-family judge if this were production."*

---

## 10. P7-B7: Semantic Cache

### 10.1 Why This Is Different From P7-A2

P7-A2 is an **exact-match** cache: only hits when the query string normalizes to the same key. Real users phrase questions differently:

- "Apple revenue 2024"
- "What was Apple's 2024 revenue?"
- "Apple's revenue in fiscal 2024?"

All three should hit the same cached answer. Exact match only catches one. Semantic cache catches all three by comparing query embeddings.

This is a **legitimately hard engineering problem** because it's a precision/recall tradeoff: too loose → stale/wrong answers; too strict → no hits. Interviewers love this.

### 10.2 Architecture

Two-tier cache:

```
Request → Exact cache (Redis, P7-A2) → hit? return
                ↓ miss
         Semantic cache (pgvector) → high-similarity match AND filters match? return
                ↓ miss
         Run full pipeline → store in BOTH caches
```

### 10.3 Schema

New table `cached_queries`:

```sql
CREATE TABLE cached_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    query_embedding vector(1536) NOT NULL,
    filters_hash TEXT NOT NULL,      -- sha256 of sorted filters JSON
    response_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    hit_count INT DEFAULT 0,
    last_hit_at TIMESTAMPTZ
);

CREATE INDEX idx_cached_queries_embedding 
ON cached_queries 
USING hnsw (query_embedding vector_cosine_ops);

CREATE INDEX idx_cached_queries_filters_hash 
ON cached_queries(filters_hash);

-- TTL via created_at + periodic cleanup
CREATE INDEX idx_cached_queries_created_at 
ON cached_queries(created_at);
```

### 10.4 Implementation

`app/core/semantic_cache.py`:

```python
import hashlib, json
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.ingestion.embedder import embed_single

SIMILARITY_THRESHOLD = 0.97  # tunable, see 10.5
MAX_AGE_HOURS = 24

class SemanticCache:
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def _filters_hash(self, filters: dict) -> str:
        sorted_filters = {k: sorted(v) if isinstance(v, list) else v for k, v in sorted(filters.items())}
        return hashlib.sha256(json.dumps(sorted_filters).encode()).hexdigest()

    async def lookup(self, query: str, filters: dict) -> Optional[dict]:
        filters_hash = self._filters_hash(filters)
        query_emb = await embed_single(query)
        
        async with self.session_factory() as session:
            row = await session.execute(text("""
                SELECT id, response_json, 
                       1 - (query_embedding <=> :qe) AS similarity
                FROM cached_queries
                WHERE filters_hash = :fh
                  AND created_at > NOW() - INTERVAL ':age hours'
                ORDER BY query_embedding <=> :qe
                LIMIT 1
            """), {"qe": query_emb, "fh": filters_hash, "age": MAX_AGE_HOURS})
            
            match = row.first()
            if match and match.similarity >= SIMILARITY_THRESHOLD:
                await emit_metric("semantic_cache_hit", similarity=match.similarity)
                await session.execute(text("""
                    UPDATE cached_queries 
                    SET hit_count = hit_count + 1, last_hit_at = NOW()
                    WHERE id = :id
                """), {"id": match.id})
                await session.commit()
                return match.response_json
        
        await emit_metric("semantic_cache_miss")
        return None

    async def store(self, query: str, filters: dict, response: dict):
        query_emb = await embed_single(query)
        filters_hash = self._filters_hash(filters)
        async with self.session_factory() as session:
            await session.execute(text("""
                INSERT INTO cached_queries (query_text, query_embedding, filters_hash, response_json)
                VALUES (:q, :qe, :fh, :r)
            """), {"q": query, "qe": query_emb, "fh": filters_hash, "r": json.dumps(response)})
            await session.commit()
```

### 10.5 Threshold Tuning Methodology

The threshold is the core engineering decision. Tune it empirically:

1. Create `eval/semantic_cache_test.csv` with 100 query pairs, each labeled:
   - `same_intent` (should hit): "Apple revenue 2024" / "What was Apple's 2024 revenue?"
   - `different_intent` (should miss): "Apple revenue 2024" / "Apple risks in 2024"
2. For each pair, compute cosine similarity of query embeddings.
3. Sweep threshold from 0.85 to 0.99 in 0.01 increments.
4. At each threshold, compute:
   - **True positive rate** (same_intent pairs that would hit)
   - **False positive rate** (different_intent pairs that would hit)
5. Plot curve. Pick threshold where FPR < 1% and TPR is maximized.

Expected: threshold around 0.96–0.98 gives ~60% TPR and <1% FPR for English financial queries. Document the exact number you chose.

### 10.6 Integration With Full Pipeline

```python
async def query_endpoint(req: QueryRequest):
    # Tier 1: exact cache
    exact_hit = await exact_cache.get("query", req.question, req.filters.dict())
    if exact_hit: return exact_hit
    
    # Tier 2: semantic cache
    semantic_hit = await semantic_cache.lookup(req.question, req.filters.dict())
    if semantic_hit: return semantic_hit
    
    # Tier 3: full pipeline
    result = await run_query_pipeline(req)
    await exact_cache.set("query", req.question, req.filters.dict(), result)
    await semantic_cache.store(req.question, req.filters.dict(), result)
    return result
```

### 10.7 Metrics

Three separate counters so hit rate tiers are visible:
- `exact_cache_hit`
- `semantic_cache_hit` (with similarity dimension binned: 0.95-0.96, 0.96-0.97, etc.)
- `cache_miss`

Daily dashboard should show: total queries, exact hit rate, semantic hit rate, combined hit rate.

### 10.8 Cleanup

Cron-style cleanup (daily or weekly):

```sql
DELETE FROM cached_queries WHERE created_at < NOW() - INTERVAL '7 days';
```

Or ECS scheduled task that runs weekly. Without cleanup the table grows unbounded.

### 10.9 Deliverable

`docs/benchmarks/semantic-cache.md`:
- Threshold tuning curve (TPR/FPR vs threshold)
- Chosen threshold and justification
- Combined hit rate observed in production
- Estimated latency savings (avg query cost × hit rate)
- Known failure modes (near-duplicate queries with different intent)

Resume bullet: *"Two-tier cache (exact + semantic via pgvector) achieving 38% combined hit rate vs 12% exact-only; 0.8% false hit rate at similarity threshold 0.97."*

Interview talking point: *"Exact-match caching missed semantically equivalent queries. I built a semantic layer using pgvector with a separate cached_queries table keyed by query embedding + filter hash. The core decision was the similarity threshold — I built a labeled test set of 100 pairs, swept threshold, chose 0.97 for <1% false hit rate accepting 24% additional hit coverage. Total combined hit rate 38%, which reduced p95 by roughly 60% on cache-eligible traffic."*

---

## 11. Claude Code Working Notes

When running these tasks through Claude Code or a similar agentic IDE:

- **Tackle P7-DEBUG before anything else.** Nothing downstream works if retrieval is broken on arbitrary queries.
- **Run migrations in a staging environment first** (P7-A3). Index drops lock writes; don't do this blindly against prod.
- **P7-A1 is long-running.** Start it, then work on P7-C3 (cost tracking) or P7-C4 (Alembic CI check) in parallel while data loads.
- **P7-B5 (LLM judge) must be calibrated before trusting.** Do not skip the kappa calibration step. An uncalibrated judge in CI is worse than no CI gate — it gives false confidence.
- **P7-B7 threshold tuning is the headline.** Do not pick 0.95 arbitrarily. Build the labeled test set, sweep, document. The engineering story lives in this process, not the code.
- **After each P7 task:** run `eval/run_full_eval.py` (from P7-B5) to ensure no regression. This is why P7-C1 (eval in CI) is valuable — it catches this automatically.
- **Commit per task.** Each P7-X ID should map to at most 1–2 PRs. Interview-friendly: "Here's the PR where I added HNSW benchmarking."

---

## 12. When You're Done

After Phase 7 is complete:

- Resume has 5+ concrete numbers (corpus size, recall@10, p95 latency, cache hit rate, kappa, Precision@5)
- README has 3+ architecture decisions with justification (index choice, cache tiering, router approach, judge calibration)
- System design talking point can fill 45 minutes
- 3+ STAR-format behavioral stories ready (debug, performance, reliability, iteration, tradeoff)
- 1 blog post explaining one decision in public (recommended: HNSW benchmark, semantic cache threshold tuning, or LLM judge calibration — all three are excellent blog topics)

At that point, the project is ready for FAANG resume submission. The rest is LeetCode and networking.
