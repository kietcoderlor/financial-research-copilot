# Ingestion Implementation Process

This document explains how document ingestion works in Financial Research Copilot — from a raw document arriving to it being fully indexed and queryable. Read this alongside [high-level-architecture.md](high-level-architecture.md) and [back-end-guide.md](back-end-guide.md).

---

## 1. Goal

The ingestion pipeline turns raw financial documents into searchable, embeddable chunks stored in PostgreSQL with pgvector. By the end of ingestion, every document chunk is:

- Stored as text with its parent metadata (company, doc type, year, quarter, section).
- Embedded as a 1536-dimensional vector in the `embedding` column.
- Indexed for full-text BM25 search via the `tsv tsvector` column.
- Available for hybrid retrieval in the `/retrieve` and `/query` endpoints.

---

## 2. End-to-End Ingestion Flow

```
Client calls POST /ingest
  → API inserts row in documents (status = 'pending')
  → API puts message on SQS: { s3_key, document_id }
  → API returns { document_id, status: "queued" }

Ingestion worker (polling SQS):
  → Receive message from SQS
  → Download file from S3 to /tmp/
  → Select parser by doc_type
  → Parse → clean text → detect sections
  → Chunk text (512 tokens, 50 overlap)
  → Generate embeddings in batches of 100
  → Deduplication check
  → Batch INSERT into document_chunks
  → Update documents.status = 'done'
  → Delete SQS message

On error at any step:
  → Update documents.status = 'failed'
  → Do NOT delete SQS message
  → SQS retries after visibility timeout (600s)
  → After 3 failures: message routed to ingestion-dlq
```

---

## 3. Trigger: POST /ingest

**File:** `app/api/ingest.py`

### Request body

```json
{
  "s3_key": "filings/AAPL/10-K/2023.html",
  "company_ticker": "AAPL",
  "company_name": "Apple Inc.",
  "doc_type": "10-K",
  "year": 2023,
  "quarter": null,
  "source_url": "https://www.sec.gov/Archives/edgar/..."
}
```

### What the endpoint does

1. Validates all required fields (Pydantic validation is automatic).
2. Checks if a document with the same `(s3_key)` already exists. If `status = 'done'`, return early with the existing `document_id` (prevent double-ingestion).
3. Inserts a new row in the `documents` table with `status = 'pending'`.
4. Puts a message on the SQS queue: `{"s3_key": ..., "document_id": ...}`.
5. Returns `{"document_id": <uuid>, "status": "queued"}`.

### Status polling

```http
GET /ingest/{document_id}
```

Returns: `{"document_id": ..., "status": "done" | "pending" | "failed", "chunk_count": 487}`.

---

## 4. SQS Queue

**Queue name:** `ingestion-queue`  
**DLQ:** `ingestion-dlq` (after 3 failed receives)  
**Visibility timeout:** 600 seconds  

The visibility timeout must exceed the maximum expected ingestion time. A large 10-K with 500+ chunks takes ~2–5 minutes (parsing + 5+ batches of embedding API calls). Set to 600s to be safe.

---

## 5. Ingestion Worker

**File:** `app/ingestion/worker.py`  
**Entry point:** `python -m app.ingestion.worker`  
**Runs as:** A separate ECS Fargate task (same Docker image, different CMD)

### Worker loop

```python
while True:
    messages = sqs.receive_message(
        QueueUrl=SQS_QUEUE_URL,
        MaxNumberOfMessages=1,
        WaitTimeSeconds=20  # long polling
    )
    for message in messages:
        process_document(message)
```

Long polling (20 seconds) reduces unnecessary API calls when the queue is empty.

### process_document(message)

```python
def process_document(message):
    s3_key = message["s3_key"]
    document_id = message["document_id"]
    
    try:
        # 1. Download from S3
        local_path = download_from_s3(s3_key)
        
        # 2. Select parser
        parser = select_parser(doc_type)
        
        # 3. Parse
        sections = parser.parse(local_path)
        
        # 4. Chunk
        chunks = chunker.chunk(sections)
        
        # 5. Embed
        embeddings = embedder.embed([c.text for c in chunks])
        
        # 6. Dedup + batch insert
        insert_chunks(document_id, chunks, embeddings)
        
        # 7. Update status
        update_document_status(document_id, "done")
        
        # 8. Delete SQS message
        sqs.delete_message(message["receipt_handle"])
        
    except Exception as e:
        logger.error({"document_id": document_id, "error": str(e)})
        update_document_status(document_id, "failed")
        # Do NOT delete the message — let SQS retry
```

---

## 6. Document Parsers

### 6.1 SEC Filing Parser

**File:** `app/ingestion/parsers/sec_parser.py`

Handles 10-K and 10-Q filings downloaded from EDGAR.

```python
from sec_edgar_downloader import Downloader

dl = Downloader("MyCompany", "email@example.com", "/tmp/filings")
dl.get("10-K", "AAPL", limit=1, after="2023-01-01", before="2024-01-01")
```

After downloading, the HTML is parsed with BeautifulSoup4. The parser:
1. Strips navigation, headers, footers, and HTML tags.
2. Detects section boundaries by looking for known SEC section headers (e.g., "Item 1A. Risk Factors", "Item 7. Management's Discussion").
3. Labels chunks with section names: `risk_factors`, `mda`, `business`, `quantitative_disclosures`.

**Test:** Parse Apple 10-K 2023. Verify section labels are present and text is clean plain text.

### 6.2 Earnings Transcript Parser

**File:** `app/ingestion/parsers/transcript_parser.py`

Handles earnings call transcripts (HTML or plain text format from Kaggle/Seeking Alpha).

The parser:
1. Detects the boundary between prepared remarks and Q&A session (usually a line like "Questions and Answers" or "Operator instructions").
2. Labels each section as `prepared_remarks` or `qa`.
3. Optionally parses speaker turns (speaker name + text block).

**Test:** Parse one transcript. Verify both section types are present and speaker attribution is correct.

### 6.3 PDF Parser (Shareholder Letters)

**File:** `app/ingestion/parsers/pdf_parser.py`

Handles PDFs using `pdfplumber`.

```python
import pdfplumber

with pdfplumber.open(path) as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            yield text
        else:
            logger.warning(f"Unreadable page {page.page_number} in {path}")
```

Important: do not crash on unreadable pages. Log a warning and continue. Some shareholder letter PDFs have scanned pages embedded alongside machine-readable text.

**Test:** Parse Berkshire Hathaway 2023 annual letter. Verify text is readable. Check that unreadable pages emit warnings rather than exceptions.

---

## 7. Chunker

**File:** `app/ingestion/chunker.py`

Uses `RecursiveCharacterTextSplitter` from LangChain with token-based sizing via `tiktoken`.

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")  # same as OpenAI text-embedding-3-small

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=50,
    length_function=lambda text: len(enc.encode(text))
)
```

**Each chunk inherits:**
- `section` from the parent document section
- `chunk_index` (sequential 0-based within the document)
- `token_count` (exact token count after splitting)

**Validation:** No chunk should exceed 600 tokens. If any do, something is wrong with the splitter configuration. Test with: `assert all(c.token_count <= 600 for c in chunks)`.

---

## 8. Embedder

**File:** `app/ingestion/embedder.py`

Calls OpenAI Embeddings API in batches of 100. Uses `tenacity` for automatic retry on rate-limit errors (HTTP 429).

```python
from tenacity import retry, wait_exponential, retry_if_exception_type
import openai

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=60),
    retry=retry_if_exception_type(openai.RateLimitError)
)
def embed_batch(texts: list[str]) -> list[list[float]]:
    response = openai.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    return [item.embedding for item in response.data]
```

**Important:** Always use `text-embedding-3-small` for both ingestion and query. Using a different model for queries would make vector similarity meaningless.

**Cost estimate:** 500 chunks × 512 tokens ≈ 256K tokens per document. At $0.02/1M tokens, that's $0.005 per document. Very cheap at this scale.

---

## 9. Deduplication Guard

Before inserting chunks, check if `(document_id, chunk_index)` already exists:

```sql
SELECT id FROM document_chunks
WHERE document_id = $1 AND chunk_index = $2;
```

If a row exists, skip the insert. This prevents double-embedding if ingestion is re-triggered for the same document (e.g., after a partial failure).

---

## 10. Database Insert

**Table:** `document_chunks`

Batch insert all chunks for a document in a single transaction:

```python
async with session.begin():
    session.add_all([
        DocumentChunk(
            document_id=document_id,
            chunk_index=chunk.chunk_index,
            chunk_text=chunk.text,
            embedding=embedding,
            section=chunk.section,
            company_ticker=doc.company_ticker,
            doc_type=doc.doc_type,
            year=doc.year,
            quarter=doc.quarter,
            token_count=chunk.token_count
        )
        for chunk, embedding in zip(chunks, embeddings)
    ])
```

The `tsv tsvector` column is automatically generated from `chunk_text` by PostgreSQL (using a `GENERATED ALWAYS AS` expression or a trigger). No manual population required.

---

## 11. Status Updates

After a successful ingestion:

```sql
UPDATE documents SET status = 'done', ingested_at = NOW() WHERE id = $1;
```

After a failure:

```sql
UPDATE documents SET status = 'failed' WHERE id = $1;
```

The SQS message is only deleted after a successful `status = 'done'` update. Never delete the message on failure — let SQS retry.

---

## 12. Supported Document Types

| `doc_type` value | Description | Parser |
|-----------------|-------------|--------|
| `10-K` | SEC annual filing | `sec_parser.py` |
| `10-Q` | SEC quarterly filing | `sec_parser.py` |
| `transcript` | Earnings call transcript | `transcript_parser.py` |
| `letter` | Shareholder / annual letter (PDF) | `pdf_parser.py` |

---

## 13. Corpus Validation

After seeding, run `scripts/check_corpus.py` to verify:

```sql
SELECT company_ticker, doc_type, year, COUNT(*) as chunk_count
FROM document_chunks
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
```

Expected: at least 3 rows (one per document type). Each with > 50 chunks. All embeddings non-null. Dimension = 1536.

Also verify DLQ is empty:
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/.../ingestion-dlq \
  --attribute-names ApproximateNumberOfMessages
```

Should return `"ApproximateNumberOfMessages": "0"`.

---

## 14. Required Environment Variables

| Variable | Description |
|---------|-------------|
| `OPENAI_API_KEY` | Used by the embedder |
| `DB_URL` | PostgreSQL connection string |
| `SQS_QUEUE_URL` | URL of `ingestion-queue` |
| `S3_BUCKET` | Name of S3 raw document bucket |
| `AWS_REGION` | AWS region (e.g., `us-east-1`) |

---

## 15. Files Involved

```
app/api/ingest.py
app/ingestion/worker.py
app/ingestion/chunker.py
app/ingestion/embedder.py
app/ingestion/parsers/sec_parser.py
app/ingestion/parsers/transcript_parser.py
app/ingestion/parsers/pdf_parser.py
app/db/models.py           (Document, DocumentChunk ORM models)
scripts/seed_corpus.py
scripts/seed_local.py
scripts/check_corpus.py
alembic/versions/          (migration files)
```
