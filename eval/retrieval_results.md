# Retrieval Spot Check Results (Heuristic)

- API URL: `http://financial-copilot-alb-133191467.us-east-1.elb.amazonaws.com`
- Query count: **15**
- Mean Precision@5 (heuristic): **0.200**
- Queries with >=3/5 Relevant: **3/15**

> Note: labels are heuristic (`Relevant`/`Partial`/`Not Relevant`) and can be manually adjusted.

## Per-query details

### Q1: Apple risk factors 2024

- Filters: `{"companies": ["AAPL"], "years": [2024], "doc_types": []}`
- Precision@5 (heuristic): **1.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|
| 1 | AAPL | 10-Q | 2024 | 0.0164 | Relevant | **Definition of done (Phase 3):** Query "Apple risk factors 2024" with `{companies: ["AAPL"], years: [2024]}` returns 5 chunks, all from Apple 2024 documents. Manual eval: ≥12/15 s... |
| 2 | AAPL | 10-Q | 2024 | 0.0161 | Relevant | **Definition of done (Phase 3):** Query "Apple risk factors 2024" with `{companies: ["AAPL"], years: [2024]}` returns 5 chunks, all from Apple 2024 documents. Manual eval: ≥12/15 s... |
| 3 | AAPL | 10-Q | 2024 | 0.0159 | Relevant | **Definition of done (Phase 3):** Query "Apple risk factors 2024" with `{companies: ["AAPL"], years: [2024]}` returns 5 chunks, all from Apple 2024 documents. Manual eval: ≥12/15 s... |
| 4 | AAPL | 10-Q | 2024 | 0.0156 | Relevant | **Definition of done (Phase 3):** Query "Apple risk factors 2024" with `{companies: ["AAPL"], years: [2024]}` returns 5 chunks, all from Apple 2024 documents. Manual eval: ≥12/15 s... |
| 5 | AAPL | transcript | 2024 | 0.0154 | Relevant | **Definition of done (Phase 3):** Query "Apple risk factors 2024" with `{companies: ["AAPL"], years: [2024]}` returns 5 chunks, all from Apple 2024 documents. Manual eval: ≥12/15 s... |

### Q2: Apple management discussion on revenue trends

- Filters: `{"companies": ["AAPL"], "years": [2023, 2024], "doc_types": ["10-K", "10-Q"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q3: Apple quantitative disclosures market risk

- Filters: `{"companies": ["AAPL"], "years": [2023, 2024], "doc_types": ["10-K", "10-Q"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q4: Apple prepared remarks earnings call

- Filters: `{"companies": ["AAPL"], "years": [2024], "doc_types": ["transcript"]}`
- Precision@5 (heuristic): **1.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|
| 1 | AAPL | transcript | 2024 | 0.0164 | Relevant | | ID | Task | Scope | Deps | Done | |----|------|-------|------|------| | P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id... |
| 2 | AAPL | transcript | 2024 | 0.0161 | Relevant | | ID | Task | Scope | Deps | Done | |----|------|-------|------|------| | P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id... |
| 3 | AAPL | transcript | 2024 | 0.0159 | Relevant | | ID | Task | Scope | Deps | Done | |----|------|-------|------|------| | P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id... |
| 4 | AAPL | transcript | 2024 | 0.0156 | Relevant | | ID | Task | Scope | Deps | Done | |----|------|-------|------|------| | P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id... |
| 5 | AAPL | transcript | 2024 | 0.0154 | Relevant | | ID | Task | Scope | Deps | Done | |----|------|-------|------|------| | P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id... |

### Q5: Apple gross margin analyst question

- Filters: `{"companies": ["AAPL"], "years": [2024], "doc_types": ["transcript"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q6: Apple business overview devices services

- Filters: `{"companies": ["AAPL"], "years": [2023], "doc_types": ["10-K"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q7: Apple 2024 quarterly liquidity and capital allocation

- Filters: `{"companies": ["AAPL"], "years": [2024], "doc_types": ["10-Q"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q8: Apple section on risk factors from 10-K only

- Filters: `{"companies": ["AAPL"], "years": [2023], "doc_types": ["10-K"]}`
- Precision@5 (heuristic): **1.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|
| 1 | AAPL | 10-K | 2023 | 0.0164 | Relevant | | ID | Task | Scope | Deps | Done | |----|------|-------|------|------| | P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id... |
| 2 | AAPL | 10-K | 2023 | 0.0161 | Relevant | | ID | Task | Scope | Deps | Done | |----|------|-------|------|------| | P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id... |
| 3 | AAPL | 10-K | 2023 | 0.0159 | Relevant | | ID | Task | Scope | Deps | Done | |----|------|-------|------|------| | P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id... |
| 4 | AAPL | 10-K | 2023 | 0.0156 | Relevant | | ID | Task | Scope | Deps | Done | |----|------|-------|------|------| | P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id... |
| 5 | AAPL | 10-K | 2023 | 0.0154 | Relevant | | ID | Task | Scope | Deps | Done | |----|------|-------|------|------| | P2-1 | **DB schema + Alembic setup** – Install Alembic. Create migration with two tables: `documents` (`id... |

### Q9: Apple section on risk factors from 10-Q only

- Filters: `{"companies": ["AAPL"], "years": [2024], "doc_types": ["10-Q"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q10: Apple transcript comments on operating leverage

- Filters: `{"companies": ["AAPL"], "years": [2024], "doc_types": ["transcript"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q11: Apple 2023 market risk disclosures

- Filters: `{"companies": ["AAPL"], "years": [2023], "doc_types": ["10-K"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q12: Apple 2024 filing discussion on macro uncertainty

- Filters: `{"companies": ["AAPL"], "years": [2024], "doc_types": ["10-Q"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q13: Apple earnings transcript demand trends by segment

- Filters: `{"companies": ["AAPL"], "years": [2024], "doc_types": ["transcript"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q14: Apple filings with management discussion and analysis

- Filters: `{"companies": ["AAPL"], "years": [2023, 2024], "doc_types": ["10-K", "10-Q"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|

### Q15: Apple transcript references to stable gross margin

- Filters: `{"companies": ["AAPL"], "years": [2024], "doc_types": ["transcript"]}`
- Precision@5 (heuristic): **0.00**

| Rank | Company | Doc Type | Year | Score | Label | Excerpt |
|---|---|---|---:|---:|---|---|
