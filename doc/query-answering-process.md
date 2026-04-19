# Query Answering Process

This document explains how a user query travels through the system — from the frontend to the final cited answer. Read this alongside [high-level-architecture.md](high-level-architecture.md) and [back-end-guide.md](back-end-guide.md).

---

## 1. Goal

When a user submits a question with optional filters, the system must:

1. Retrieve the most relevant document chunks from the corpus.
2. Generate a grounded answer using only those chunks as context.
3. Return the answer with precise citations that resolve back to real source documents.

The system must never answer from the LLM's training memory. If the corpus doesn't contain relevant information, the system must say so explicitly.

---

## 2. End-to-End Query Flow

```
User submits question + filters (frontend)
  ↓
POST /query { question, filters }
  ↓
Check Redis cache (key: sha256(question + json(filters)))
  → Cache hit:  return cached response (< 50ms)  ← DONE
  → Cache miss: continue
  ↓
Validate request (non-empty question, valid ticker symbols if provided)
  ↓
[RETRIEVAL PIPELINE]
  ↓
1. Embed query → text-embedding-3-small (cache in Redis, TTL 1h)
  ↓
2. Vector search → pgvector cosine, filtered by metadata → top-20 candidates
  ↓
3. BM25 full-text search → tsvector ts_rank, same filters → top-20 candidates
  ↓
4. RRF fusion → deduplicate + merge → unified ranked list
  ↓
5. Cohere Rerank → top-5 chunks
  ↓
[GENERATION PIPELINE]
  ↓
6. Classify query type (single_company / comparison / bull_bear / general)
  ↓
7. Build context string (numbered blocks [1]...[5])
  ↓
8. Call Anthropic Claude (system prompt + context + query)
  ↓
9. Parse citation indices from answer text
  ↓
10. Validate citations (flag hallucinated indices)
  ↓
Store result in Redis cache (TTL 24h)
  ↓
Return structured response: { answer, citations, metadata }
  ↓
Frontend renders answer + citation panel
```

---

## 3. API Endpoint: POST /query

**File:** `app/api/query.py`

### Request

```json
{
  "question": "What are Apple's key risk factors in their 2024 10-K?",
  "filters": {
    "companies": ["AAPL"],
    "years": [2024],
    "doc_types": ["10-K"]
  }
}
```

All filter fields are optional. Omitting them means "search all documents in the corpus."

### Response

```json
{
  "answer": "Apple's 2024 10-K identifies several key risk factors. The company notes increasing competition in all product categories [1]. Supply chain concentration in Asia remains a significant operational risk [2]. Regulatory scrutiny, particularly from the EU regarding App Store practices, is cited as a material risk [3].",
  "citations": [
    {
      "index": 1,
      "chunk_id": "uuid-...",
      "company": "AAPL",
      "doc_type": "10-K",
      "year": 2024,
      "section": "risk_factors",
      "source_url": "https://www.sec.gov/...",
      "excerpt": "The Company faces intense competition in all markets in which it participates..."
    },
    ...
  ],
  "metadata": {
    "query_type": "single_company",
    "chunks_retrieved": 20,
    "chunks_used": 5,
    "retrieval_ms": 145,
    "rerank_ms": 203,
    "llm_ms": 1840,
    "input_tokens": 3241,
    "output_tokens": 287,
    "total_ms": 2188,
    "cache_hit": false
  }
}
```

---

## 4. Redis Cache

**File:** `app/api/query.py` (cache check at top of handler)

**Key:** `query:{sha256(question + json(filters, sort_keys=True))}`  
**TTL:** 24 hours  
**On hit:** Return immediately with `metadata.cache_hit: true`

```python
cache_key = f"query:{sha256(question + json.dumps(filters, sort_keys=True))}"
cached = await redis.get(cache_key)
if cached:
    result = json.loads(cached)
    result["metadata"]["cache_hit"] = True
    return result
```

Financial research queries are highly repetitive. "Summarize Apple Q4 2024 earnings" will be asked many times. Caching reduces latency from ~2–3 seconds to < 50ms and eliminates repeated LLM API costs.

---

## 5. Retrieval Pipeline

**File:** `app/retrieval/pipeline.py`

The retrieval pipeline is called with: `retrieve(query, filters, top_k=20, top_n=5)`.

### Step 1: Query Embedding

**File:** `app/retrieval/query_embedder.py`

```python
cache_key = f"embed:{sha256(query)}"
cached_embedding = await redis.get(cache_key)
if cached_embedding:
    return json.loads(cached_embedding)

embedding = openai.embeddings.create(
    model="text-embedding-3-small",
    input=query
).data[0].embedding

await redis.setex(cache_key, 3600, json.dumps(embedding))  # TTL 1h
return embedding
```

The same query may appear in multiple requests within an hour (e.g., during interactive exploration). Caching the embedding saves ~50ms per request.

### Step 2: Vector Search

**File:** `app/retrieval/vector_search.py`

```sql
SELECT
    id as chunk_id,
    chunk_text,
    company_ticker,
    doc_type,
    year,
    quarter,
    section,
    source_url,
    1 - (embedding <=> $query_vec) AS score
FROM document_chunks
WHERE
    ($companies IS NULL OR company_ticker = ANY($companies))
    AND ($years IS NULL OR year = ANY($years))
    AND ($doc_types IS NULL OR doc_type = ANY($doc_types))
ORDER BY embedding <=> $query_vec
LIMIT 20;
```

Returns top-20 candidates with cosine similarity scores.

### Step 3: BM25 / Full-Text Search

**File:** `app/retrieval/bm25_search.py`

```sql
SELECT
    id as chunk_id,
    chunk_text,
    company_ticker,
    doc_type,
    year,
    section,
    source_url,
    ts_rank(tsv, plainto_tsquery('english', $query)) AS score
FROM document_chunks
WHERE
    tsv @@ plainto_tsquery('english', $query)
    AND ($companies IS NULL OR company_ticker = ANY($companies))
    AND ($years IS NULL OR year = ANY($years))
ORDER BY score DESC
LIMIT 20;
```

BM25 is especially effective for financial queries with precise terminology: ticker symbols, financial metrics ("EBITDA", "free cash flow"), section names ("Risk Factors", "MD&A").

### Step 4: Reciprocal Rank Fusion

**File:** `app/retrieval/fusion.py`

Merges the two ranked lists without needing to normalize scores across different retrieval methods.

```python
def rrf_score(rank: int, k: int = 60) -> float:
    return 1.0 / (k + rank)

def reciprocal_rank_fusion(
    vector_results: list[ChunkResult],
    bm25_results: list[ChunkResult]
) -> list[ChunkResult]:
    scores: dict[str, float] = {}
    chunks: dict[str, ChunkResult] = {}

    for rank, chunk in enumerate(vector_results, start=1):
        scores[chunk.chunk_id] = scores.get(chunk.chunk_id, 0) + rrf_score(rank)
        chunks[chunk.chunk_id] = chunk

    for rank, chunk in enumerate(bm25_results, start=1):
        scores[chunk.chunk_id] = scores.get(chunk.chunk_id, 0) + rrf_score(rank)
        chunks[chunk.chunk_id] = chunk

    sorted_ids = sorted(scores, key=lambda k: scores[k], reverse=True)
    return [chunks[id] for id in sorted_ids]
```

A chunk appearing in the top-5 of both lists scores much higher than one appearing in only one list. k=60 is a standard parameter that works well without tuning.

### Step 5: Cohere Reranker

**File:** `app/retrieval/reranker.py`

```python
response = cohere.rerank(
    model="rerank-v3.5",
    query=query,
    documents=[c.chunk_text[:2048] for c in candidates],  # truncate to 512 tokens
    top_n=5
)

reranked = []
for result in response.results:
    chunk = candidates[result.index]
    chunk.score = result.relevance_score
    reranked.append(chunk)

return reranked
```

The cross-encoder reads query and chunk together, giving a much more accurate relevance score than the bi-encoder embedding similarity. This is the highest-leverage quality improvement in the pipeline.

**Why truncate to 512 tokens?** Cohere has a per-document token limit. Truncating avoids silent errors and keeps latency predictable (~200ms for 20 candidates).

---

## 6. Generation Pipeline

### Step 6: Query Type Classification

**File:** `app/generation/classifier.py`

Simple keyword heuristics — fast and good enough for V1:

```python
def classify_query(question: str) -> QueryType:
    q = question.lower()
    if any(w in q for w in ["compare", "vs", "versus", "difference between"]):
        return QueryType.COMPARISON
    if any(w in q for w in ["bull case", "bear case", "upside", "downside risk"]):
        return QueryType.BULL_BEAR
    if any(w in q for w in ["summarize", "overview", "what is", "tell me about"]):
        return QueryType.SINGLE_COMPANY
    return QueryType.GENERAL
```

The query type adds format-specific instructions to the user message (e.g., comparison queries get "Please structure your answer with a comparison table" appended).

### Step 7: Context Builder

**File:** `app/generation/context_builder.py`

Formats each chunk as a numbered block:

```
[1] Company: AAPL | Source: 10-K 2024 | Section: risk_factors
The Company faces intense competition across its primary product categories.
In the smartphone market, Samsung and other Android manufacturers...

[2] Company: AAPL | Source: 10-K 2024 | Section: risk_factors
Supply chain concentration remains a significant risk. The majority of the
Company's products are assembled in Asia...
```

Token budget check: if total context exceeds 150K tokens, drop the lowest-ranked chunks until it fits. This handles edge cases without crashing.

### Step 8: LLM Call

**File:** `app/generation/llm.py`

```python
response = anthropic.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=2048,
    system=system_prompt,
    messages=[{
        "role": "user",
        "content": f"{format_instructions}\n\nContext:\n{context_str}\n\nQuestion: {question}"
    }]
)
```

**System prompt rules** (from `app/generation/prompts/system_prompt.txt`):
- Answer ONLY using the provided context.
- Cite every factual claim with `[N]` where N is the chunk index.
- If the context is insufficient, respond with: "I don't have sufficient information in my knowledge base to answer this question."
- Do not use information from training data that is not present in the context.

The system prompt must be explicit and tested before wiring to code. Test it directly in Claude.ai with sample context blocks.

### Step 9: Citation Parser

**File:** `app/generation/citation_parser.py`

```python
import re

def parse_citations(answer_text: str, chunks: list[ChunkResult]) -> list[Citation]:
    indices = re.findall(r'\[(\d+(?:,\s*\d+)*)\]', answer_text)
    flat_indices = [int(i.strip()) for group in indices for i in group.split(',')]
    unique_indices = sorted(set(flat_indices))

    citations = []
    for idx in unique_indices:
        if idx < 1 or idx > len(chunks):
            logger.warning(f"Hallucinated citation index: {idx}")
            continue  # exclude from response
        chunk = chunks[idx - 1]  # 1-based indexing
        citations.append(Citation(
            index=idx,
            chunk_id=chunk.chunk_id,
            company=chunk.company_ticker,
            doc_type=chunk.doc_type,
            year=chunk.year,
            section=chunk.section,
            source_url=chunk.source_url,
            excerpt=chunk.chunk_text[:200]
        ))

    return citations
```

**Hallucinated citations** are indices the model invented that don't correspond to any provided chunk. These are logged as warnings and excluded from the response. Hallucinated citations are worse than no citations — they undermine user trust.

---

## 7. Cache Store + Return

After generating the response, store in Redis:

```python
await redis.setex(cache_key, 86400, json.dumps(response.dict()))
```

Then return the structured response to the frontend.

---

## 8. Latency Breakdown

A complete `/query` request (no cache) breaks down roughly as:

| Step | Typical latency |
|------|----------------|
| Query embedding (cache miss) | ~50ms |
| Vector search | ~50ms |
| BM25 search | ~30ms |
| RRF fusion | < 5ms |
| Cohere reranker | ~200ms |
| LLM generation | ~1500–2000ms |
| Citation parsing | < 5ms |
| **Total** | **~1850–2340ms** |

On cache hit: < 50ms.

Target p50 for the full `/query` endpoint: < 5 seconds.

---

## 9. The /retrieve Endpoint

`POST /retrieve` runs only the retrieval pipeline (steps 1–5) without generation. It is used for:
- Manual retrieval evaluation (notebook-based spot-checking).
- Frontend "Show sources" feature (optional V2).
- Debugging retrieval quality independently of generation.

```json
{
  "query": "Apple margin drivers Q3 2024",
  "filters": { "companies": ["AAPL"], "years": [2024] }
}
```

Response: `{chunks: [...top-5 with metadata and scores...], latency: {...}}`.

---

## 10. Adversarial Query Handling

When a query has no relevant chunks in the corpus (company not ingested, future event, unrelated topic), the top-5 chunks returned by retrieval will have low relevance scores. The system prompt instructs the LLM to respond with the "insufficient information" message instead of hallucinating.

This must be tested explicitly. A query like "What is Apple's revenue in 2030?" should always return the refusal, not a made-up number.

---

## 11. Files Involved

```
app/api/query.py
app/api/retrieve.py
app/retrieval/pipeline.py
app/retrieval/query_embedder.py
app/retrieval/vector_search.py
app/retrieval/bm25_search.py
app/retrieval/fusion.py
app/retrieval/reranker.py
app/generation/context_builder.py
app/generation/classifier.py
app/generation/llm.py
app/generation/citation_parser.py
app/generation/prompts/system_prompt.txt
app/models/requests.py
app/models/responses.py
```
