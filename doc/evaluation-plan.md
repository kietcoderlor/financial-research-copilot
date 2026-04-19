# Evaluation Plan

**Document type:** Evaluation methodology  
**Scope:** V1 — Financial Research Copilot  
**Last updated:** April 2026

> Without an evaluation benchmark, you built a demo. With it, you built a system. The benchmark is what makes this project stand out in interviews.

---

## 1. Why Evaluate?

Most portfolio RAG projects are built but never measured. A structured evaluation with concrete numbers ("Precision@5 = 0.78 before reranker, 0.91 after") demonstrates:

- **Production mindset:** You treat the system as something to be measured and improved, not just shipped.
- **Engineering depth:** You can explain what went wrong, why, and what you changed.
- **Interview talking points:** "In my evaluation, I found that BM25 improved precision on queries with exact financial terms by X%" is a specific, credible claim.

---

## 2. What We Measure

### 2.1 Retrieval Quality

**Metric: Precision@5**

For each query, are the top-5 retrieved chunks actually relevant?

```
Precision@5 = (number of relevant chunks in top-5) / 5
```

Labels: each of the 5 chunks is manually marked **Relevant (1)** or **Not Relevant (0)**.

A chunk is Relevant if it contains information that directly helps answer the query. A chunk about the same company but a different year, or the same year but a different topic, is Not Relevant.

**Target:** Mean Precision@5 ≥ 0.75 after the improvement iteration.

### 2.2 Citation Accuracy

**Metric: Citation accuracy rate**

For each generated answer, do all cited chunk indices (`[1]`, `[2]`, etc.) resolve to real chunk IDs in the database?

```
Citation accuracy = (answers with all citations valid) / (total answers)
```

A citation is invalid if: the index is out of range, the chunk ID doesn't exist in the database, or the cited chunk doesn't actually support the claim in the answer text (hallucinated attribution).

**Target:** ≥ 85%.

### 2.3 Adversarial Refusal Rate

**Metric: Refusal rate on adversarial queries**

For queries where the answer is not in the corpus (company not ingested, future event, fabricated scenario), does the system respond with "I don't have sufficient information" rather than hallucinating?

**Target:** 100%. Zero tolerance for hallucination on adversarial queries.

### 2.4 Manual Quality Rating

**Metric: Mean quality score (1–5)**

A human reviewer (you) rates a sample of 20 generated answers on a 1–5 scale:

| Score | Meaning |
|-------|---------|
| 5 | Accurate, well-structured, all claims grounded in retrieved context |
| 4 | Mostly accurate; minor imprecision or one unsupported claim |
| 3 | Partially correct; some grounded claims but also unsupported assertions |
| 2 | Mostly incorrect or unhelpful; poor grounding |
| 1 | Hallucinated, misleading, or completely off-topic |

**Target:** Mean quality score ≥ 3.5.

### 2.5 Latency

**Metrics: p50 and p95 for each pipeline step**

Logged automatically via CloudWatch structured JSON. Query with Logs Insights:

```sql
fields retrieval_ms, rerank_ms, llm_ms, total_ms
| stats pct(retrieval_ms, 50) as p50_retrieval,
        pct(rerank_ms, 50) as p50_rerank,
        pct(llm_ms, 50) as p50_llm,
        pct(total_ms, 50) as p50_total,
        pct(total_ms, 95) as p95_total
```

**Targets:**
- `/retrieve` p50 < 800ms
- `/query` p50 < 5 seconds
- `/query` p50 on cache hit < 50ms

---

## 3. Evaluation Dataset

**File:** `eval/questions.csv`

**Columns:** `id`, `question`, `filters`, `expected_companies`, `question_type`, `ground_truth_summary`

**Size:** 30–50 questions total.

### Question type distribution

| Type | Count | Example |
|------|-------|---------|
| `single_company_factual` | 15 | "What was Apple's gross margin in Q3 2024?" |
| `multi_company_comparison` | 10 | "Compare Apple and Microsoft capex guidance in 2024." |
| `synthesis` | 8 | "What are the main risk drivers for semiconductor companies in 2024?" |
| `bull_bear` | 5 | "What is the bull case for TSLA based on recent filings?" |
| `adversarial` | 5 | "What is Apple's revenue forecast for 2030?" |

### Ground truth

For each factual question, manually find the ground truth answer in the source document. Record a 1–3 sentence summary in `ground_truth_summary`.

This is the most time-consuming part of evaluation — it's also what makes the evaluation credible. Don't skip it.

---

## 4. Evaluation Scripts

### 4.1 Retrieval Evaluation

**File:** `eval/evaluate_retrieval.py`

```python
import csv
import requests

questions = list(csv.DictReader(open("eval/questions.csv")))
results = []

for q in questions:
    filters = json.loads(q["filters"]) if q["filters"] else {}
    response = requests.post(
        "http://localhost:8000/retrieve",
        json={"query": q["question"], "filters": filters}
    )
    chunks = response.json()["chunks"]

    # Manual labeling step — print each chunk and ask for label
    labels = []
    for i, chunk in enumerate(chunks[:5]):
        print(f"\n[{i+1}] {chunk['company']} {chunk['doc_type']} {chunk['year']} | {chunk['section']}")
        print(chunk['text'][:300])
        label = input("Relevant? (1/0): ").strip()
        labels.append(int(label))

    precision_at_5 = sum(labels) / 5
    results.append({
        "id": q["id"],
        "question": q["question"],
        "question_type": q["question_type"],
        "precision_at_5": precision_at_5,
        "labels": labels
    })

# Save results
with open("eval/retrieval_scores.md", "w") as f:
    f.write("# Retrieval Evaluation Results\n\n")
    mean_p5 = sum(r["precision_at_5"] for r in results) / len(results)
    f.write(f"**Mean Precision@5: {mean_p5:.3f}**\n\n")
    for r in results:
        f.write(f"- [{r['id']}] {r['question'][:60]}... → P@5={r['precision_at_5']:.2f}\n")
```

### 4.2 Generation Evaluation

**File:** `eval/evaluate_generation.py`

```python
for q in questions:
    response = requests.post(
        "http://localhost:8000/query",
        json={"question": q["question"], "filters": filters}
    )
    data = response.json()
    answer = data["answer"]
    citations = data["citations"]

    # Check 1: citation accuracy
    num_chunks = data["metadata"]["chunks_used"]
    valid_citations = all(1 <= c["index"] <= num_chunks for c in citations)

    # Check 2: adversarial refusal
    if q["question_type"] == "adversarial":
        refused = "sufficient information" in answer.lower()

    # Check 3: manual quality rating (for sampled 20)
    if q["id"] in sampled_ids:
        print(f"\nQ: {q['question']}")
        print(f"A: {answer[:500]}")
        rating = int(input("Quality (1-5): ").strip())
```

---

## 5. Failure Analysis

**File:** `eval/failure_analysis.md`

After the first evaluation run, identify the 5 queries with the lowest Precision@5. For each, determine the root cause:

| Root cause | Description | Likely fix |
|-----------|-------------|-----------|
| **Missing data** | The answer exists in a document not yet ingested | Add more corpus data |
| **Bad chunking** | Answer is split across a chunk boundary | Increase `chunk_overlap` |
| **Retrieval strategy failure** | Vector search and BM25 both miss the relevant chunk | Check if BM25 query preprocessing is correct |
| **Metadata mismatch** | Filter too narrow / incorrect year in filter | Fix filter validation |
| **Embedding model limitation** | Semantic gap between query phrasing and chunk content | Try query rewriting or different embedding model |

---

## 6. One Targeted Improvement

Based on the failure analysis, implement **exactly one fix**. Don't try to fix everything — over-optimization in V1 delays completion without proportional quality gain.

### Example improvement scenarios

**If mean Precision@5 < 0.6:**
Experiment with `chunk_overlap=100` instead of 50. Re-embed the corpus (run `scripts/seed_corpus.py` after clearing existing chunks). Re-run evaluation. Record before/after.

**If BM25 underperforms on multi-word queries:**
Switch from `plainto_tsquery` to `websearch_to_tsquery` for better multi-word handling. Re-run retrieval evaluation. Record before/after.

**If citation accuracy < 80%:**
Add post-processing validation: after LLM generation, verify each cited `[N]` exists in the provided chunks. Exclude invalid citations from the response. Re-run generation evaluation. Record before/after.

**If adversarial refusal rate < 100%:**
Strengthen the system prompt. Add explicit examples of refusal to the prompt. Re-test all adversarial queries.

### Recording results

**File:** `eval/improvement_results.md`

```markdown
## Improvement: Increased chunk_overlap from 50 to 100

**Hypothesis:** Low Precision@5 on multi-section queries is caused by relevant
content being split at chunk boundaries.

**Change:** Updated chunker.py: chunk_overlap=50 → chunk_overlap=100.
Re-embedded full corpus (~1.2M tokens, cost: ~$0.024).

**Results:**
| Metric | Before | After |
|--------|--------|-------|
| Mean Precision@5 | 0.68 | 0.79 |
| P@5 on single-company | 0.74 | 0.83 |
| P@5 on comparison | 0.61 | 0.74 |
| P@5 on synthesis | 0.65 | 0.77 |

**Conclusion:** Overlap increase improved Precision@5 by 0.11 overall.
The biggest gain was on comparison queries, likely because multi-company
context spans section boundaries more often.
```

---

## 7. Portfolio Artifacts

After completing the evaluation, produce these artifacts:

### eval/retrieval_scores.md
- Mean Precision@5 across all questions
- Breakdown by question type
- Per-question results with labels

### eval/generation_scores.md
- Citation accuracy rate
- Adversarial refusal rate
- Mean quality score for sampled answers

### eval/failure_analysis.md
- Top-5 worst-performing queries
- Root cause for each
- Chosen improvement and rationale

### eval/improvement_results.md
- Before/after comparison for the one improvement implemented

### README.md (project root)
Include a summary of evaluation results in the README:
```markdown
## Evaluation Results

| Metric | Score |
|--------|-------|
| Retrieval Precision@5 (baseline) | 0.68 |
| Retrieval Precision@5 (after improvement) | 0.79 |
| Citation accuracy | 91% |
| Adversarial refusal rate | 100% |
| Mean quality score (1–5) | 3.9 |
```

---

## 8. What Not to Do

**Don't skip evaluation because it feels like extra work.** The benchmark is the thing that makes this project legit. Without it, you built a demo. With it, you built a system.

**Don't try to optimize everything.** Pick the one metric that matters most (Precision@5) and improve it once. Over-optimization delays completion and yields diminishing returns.

**Don't write a generic README.** The README should explain *your specific decisions* — why pgvector, why hybrid retrieval, why Cohere Rerank — not just what the project does. This is what gets read in interviews.

**Don't retroactively redesign the architecture based on M6 findings.** Note improvements in a "Future Work / V2" section instead. Ship V1.

---

## 9. Related Documents

- [developer-tasks.md](developer-tasks.md) – P6 tasks with detailed acceptance criteria
- [query-answering-process.md](query-answering-process.md) – How the pipeline works (what you're evaluating)
- [requirements.md](requirements.md) – Non-functional targets for latency and citation accuracy
