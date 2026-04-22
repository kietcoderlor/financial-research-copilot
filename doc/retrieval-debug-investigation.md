# Retrieval Debug Investigation

**Symptom:** Queries matching the suggested chips on the homepage (e.g., "Apple risk factors 2024") return results. Arbitrary queries (e.g., "Tesla margin guidance", "Microsoft cloud growth drivers", "Goldman Sachs risk factors") return empty or semantically unrelated results.

**Goal of this document:** Provide Claude Code (or a human debugger) a systematic checklist to identify the root cause in 1–2 hours and ship the fix within a day. This is task **P7-DEBUG-1 and P7-DEBUG-2** in `phase7-developer-tasks.md`.

---

## 1. Hypotheses Ranked by Prior Probability

Based on the project description and typical RAG failure modes, the likely causes in descending order:

| # | Hypothesis | Prior | How to confirm |
|---|-----------|-------|----------------|
| H1 | **Corpus too small** — only 3 seed documents. Arbitrary queries literally have no relevant chunks to retrieve. | ~60% | SQL: `SELECT COUNT(*), COUNT(DISTINCT company_ticker) FROM document_chunks;` |
| H2 | **Similarity threshold too strict** — a `score > X` filter cuts low-score results. With small corpus, all arbitrary queries score below the cutoff. | ~20% | Grep for threshold constants in `app/retrieval/`; test `/retrieve` directly. |
| H3 | **Frontend filter state leak** — clicking a suggested chip sets filters that persist when user types a new query. | ~10% | Browser DevTools → Network tab → inspect `/query` payload after chip click vs. manual type. |
| H4 | **Generator refusal on low-confidence retrievals** — retrieval returns chunks but generator says "I don't have enough information" and frontend interprets as empty. | ~5% | Call `/retrieve` directly: if it returns chunks but `/query` is empty, generator is refusing. |
| H5 | **Metadata filter mismatch** — queries imply filters (e.g., "2024") that match no ingested docs because the corpus only has 2023. | ~5% | Check ingested years: `SELECT DISTINCT year FROM documents;`. |

Multiple hypotheses can be true simultaneously. The investigation below tests each independently.

---

## 2. Investigation Checklist

Run these steps in order. Record findings in `docs/debug/retrieval-arbitrary-query-rca.md` as you go.

### Step 1 — Corpus inventory (tests H1, H5)

Connect to the production (or local) RDS instance and run:

```sql
-- Total corpus size
SELECT COUNT(*) AS total_chunks FROM document_chunks;
SELECT COUNT(*) AS total_documents FROM documents WHERE status = 'done';

-- Coverage by company
SELECT company_ticker, COUNT(*) AS chunks
FROM document_chunks
GROUP BY 1
ORDER BY 2 DESC;

-- Coverage by year
SELECT year, COUNT(DISTINCT document_id) AS docs
FROM document_chunks
GROUP BY 1
ORDER BY 1;

-- Coverage by doc_type
SELECT doc_type, COUNT(*) AS chunks
FROM document_chunks
GROUP BY 1;
```

**Expected if H1 is true:** `total_chunks` is under 2000, `company_ticker` distinct count is under 5. Arbitrary queries asking about companies not in the list will naturally fail.

**Expected if H5 is true:** The years covered don't include 2024, but suggested queries implicitly filter for available years.

### Step 2 — Direct `/retrieve` call (tests H2)

Bypass the frontend and call the retrieval endpoint directly with arbitrary queries:

```bash
API_URL="https://<your-alb-dns>"  # or http://localhost:8000

# Query 1: company that is ingested
curl -sS -X POST "$API_URL/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query": "Apple revenue growth", "top_k": 10}' | jq .

# Query 2: company likely NOT ingested in seed
curl -sS -X POST "$API_URL/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query": "Tesla margin guidance", "top_k": 10}' | jq .

# Query 3: semantically broad
curl -sS -X POST "$API_URL/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query": "macroeconomic headwinds", "top_k": 10}' | jq .
```

**Record for each:**
- Number of results returned
- Similarity/relevance score of top result
- Whether results are semantically related

**Expected if H2 is true:** Retrieval returns 0 results even though chunks exist in the DB. Check `app/retrieval/` for:

```bash
grep -rn "threshold\|min_score\|min_similarity" app/retrieval/
grep -rn "WHERE.*score\|HAVING" app/retrieval/
```

Look for hardcoded thresholds. Common culprits:
```python
# in app/retrieval/hybrid.py or vector.py
MIN_SIMILARITY = 0.5  # ← too strict for cross-domain queries
results = [r for r in results if r.score > MIN_SIMILARITY]
```

### Step 3 — Direct `/query` call (tests H4)

```bash
curl -sS -X POST "$API_URL/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "Tesla margin guidance"}' | jq .
```

**If `/retrieve` returns chunks but `/query` returns empty answer:** generator is refusing. Check `app/generation/generator.py` for refusal logic:

```bash
grep -rn "refuse\|not enough\|insufficient\|cannot answer" app/generation/
```

Some RAG setups have the generator explicitly refuse when retrieved chunks are low-relevance. That's a reasonable choice, but it should still return *something* (like "I don't have documents about this topic" with the retrieved chunks visible). Check if the frontend hides retrieved chunks when the answer is a refusal.

### Step 4 — Frontend filter leak (tests H3)

In a fresh incognito browser window:

1. Open DevTools → Network tab, filter for `/query` and `/retrieve`.
2. Click a suggested chip. Observe the request payload.
3. **Without reloading**, clear the textarea, type "Tesla margins", submit.
4. Compare payload to step 2.

**Expected if H3 is true:** The second request still includes filters from the first (e.g., `"company_ticker": "AAPL"`).

Check React state management in `app/page.tsx` or the FilterPanel component:

```bash
grep -rn "setFilters\|filters" app/ components/
```

Look for chip-click handlers that set filters but don't reset them on textarea change.

### Step 5 — Server-side log inspection (cross-check)

In CloudWatch Logs Insights for log group `/ecs/financial-copilot`:

```
fields @timestamp, path, method, status_code, duration_ms, @message
| filter path like /retrieve|query/
| sort @timestamp desc
| limit 50
```

Look for:
- Requests that returned 200 but had `results_count: 0`
- Duration patterns — very fast (<50ms) empty responses suggest short-circuit filtering (H2 or H3)
- Filter parameters in request logs — if filters are always present, that confirms H3

---

## 3. Decision Tree for Fix Strategy

After completing Step 1–5, pick a fix based on findings:

```
Corpus has <10 tickers?
├── YES → Primary fix: P7-A1 (expand corpus). This alone likely resolves the issue.
│         Also consider adding a "no results found" message in UI with suggested queries.
└── NO → Continue below.

/retrieve returns 0 results for arbitrary queries?
├── YES → H2 confirmed. Fix:
│         1. Remove/lower hardcoded similarity threshold.
│         2. OR: implement a graceful fallback — if strict retrieval returns <3 results,
│            relax the threshold and retry before giving up.
└── NO → Continue below.

/retrieve returns chunks but /query returns empty?
├── YES → H4 confirmed. Fix:
│         1. Generator should produce "No documents found about this topic, but here's
│            what I did find: ..." instead of silent refusal.
│         2. Frontend should always show retrieved sources even if answer is a refusal.
└── NO → Continue below.

Filters leak from chip-click to manual query?
├── YES → H3 confirmed. Fix:
│         1. On textarea change, if text doesn't match any suggested chip, clear filters.
│         2. OR: make chips explicitly set filters + show a "clear filters" button.
│         3. OR: remove filter-setting behavior from chips entirely.
└── NO → Investigation inconclusive. Add logging, repro, escalate.
```

---

## 4. Minimum Fix Package

Regardless of root cause, this package should ship together as the P7-DEBUG-2 deliverable:

### 4.1 Code changes

- Fix identified by decision tree above.
- **Graceful fallback** in `app/retrieval/`: if the primary retrieval returns <3 results, relax filters (drop metadata filters one by one) before returning empty. Log when fallback triggers.
- **Empty-state UI** in frontend: when API returns no results, show a helpful message listing ingested companies/years so the user knows the actual corpus.

### 4.2 Regression tests

Add to `eval/questions.csv` or a new `eval/arbitrary_queries.csv`:

```csv
id,question,expected_nonzero_results,notes
DBG-1,"Tesla margin guidance",1,"Verifies cross-company retrieval"
DBG-2,"Microsoft cloud growth drivers",1,"Verifies tech-adjacent retrieval"
DBG-3,"Goldman Sachs risk factors",1,"Verifies finance sector retrieval"
DBG-4,"inflation impact on retail",1,"Verifies thematic retrieval"
DBG-5,"supply chain disruptions",1,"Verifies concept retrieval across docs"
DBG-6,"effective tax rate changes",1,"Verifies specific financial term"
DBG-7,"executive compensation practices",1,"Verifies governance topic"
DBG-8,"stock buyback programs",1,"Verifies capital allocation topic"
DBG-9,"segment revenue breakdown",1,"Verifies reporting-structure topic"
DBG-10,"forward-looking statements risks",1,"Verifies common filing language"
```

For each, assert that `/retrieve` returns at least 1 result with cosine similarity > 0.5. Add to the CI eval smoke test (P7-C1).

### 4.3 Documentation

Update `docs/debug/retrieval-arbitrary-query-rca.md` with:
- Hypotheses tested and results
- Root cause identified
- Fix implemented
- Before/after metrics (e.g., "Before: 0/10 arbitrary queries returned results. After: 10/10.")

This becomes an interview story: *"I had a bug where the demo only worked on pre-selected queries. I ruled out hypotheses systematically by testing the retrieval layer in isolation, identified that [root cause], and fixed it by [fix]. Added 10 regression queries to the eval suite to prevent recurrence."*

---

## 5. Claude Code Execution Prompt

If driving this through Claude Code, use this as the starting instruction:

> Read `retrieval-debug-investigation.md`. Execute Step 1 through Step 5 in order, recording findings in `docs/debug/retrieval-arbitrary-query-rca.md` as you go. For each step, show me the output before proceeding to the next. After Step 5, propose the fix based on the decision tree, then implement it. After implementation, run the 10 regression queries from section 4.2 and report pass/fail for each.

Do not let Claude Code skip straight to implementation without running the diagnostic steps — the diagnostic is itself the valuable engineering exercise, and the interview story depends on understanding *why* the bug happened, not just fixing it.
