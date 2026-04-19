# Financial Research Copilot – Project Overview

**Document type:** Project overview / portfolio context  
**Scope:** V1 — solo portfolio project, production-oriented  
**Last updated:** April 2026

---

## 1. What is this project?

Financial Research Copilot is a production-grade RAG (Retrieval-Augmented Generation) system that lets users ask financial research questions and receive grounded, cited answers drawn from real documents.

The system ingests SEC filings, earnings call transcripts, and shareholder letters, then answers questions like:

- "What are Apple's key risk factors in their 2024 10-K?"
- "Compare revenue growth guidance from Apple and Microsoft in Q3 2024."
- "What is the bull case vs bear case for TSLA based on recent filings?"

Every answer is grounded in retrieved source chunks — not LLM training memory — with explicit citations back to the original documents.

---

## 2. Why build this?

This project is not a generic PDF chatbot. It demonstrates a specific set of production AI engineering skills that are increasingly required but rarely shown in portfolios:

| Skill area | What this project shows |
|-----------|------------------------|
| AI engineering | Hybrid retrieval, reranking, grounded generation, citation parsing |
| Backend / system design | Async ingestion pipeline, REST API, service boundaries |
| Cloud deployment | AWS ECS/Fargate, RDS, S3, SQS, ElastiCache, CloudWatch |
| Data engineering | Document parsing, chunking strategy, metadata schema, embeddings |
| Evaluation mindset | Structured benchmark, Precision@5, citation accuracy, before/after improvement |

The goal is to close the gap between *academic AI research* and *production AI engineering* — exactly what differentiates mid-level from senior AI engineer candidates.

---

## 3. Portfolio positioning

This project fits into a profile that includes:

- **CSAI Lab** → AI research background
- **FPT internship** → backend SWE experience
- **Trading Lab** → full-stack team project
- **Financial Research Copilot** → AI systems + AWS + production mindset

The combination demonstrates breadth (research → backend → full-stack → AI systems) and production depth (the system is deployed, measured, and documented like a real engineering deliverable).

---

## 4. Target user flow (V1)

1. User opens the demo at the public Vercel URL.
2. User types a financial question (e.g., "Summarize Apple's margin drivers in Q3 2024").
3. User optionally selects filters: company, year, document type.
4. User submits the query.
5. The system retrieves relevant chunks from ingested documents, reranks them, and generates a grounded answer.
6. The UI shows the answer with inline citations and a source panel (company, doc type, year, section, excerpt).

---

## 5. Final V1 deliverable

- Publicly accessible Vercel demo connected to a deployed FastAPI backend on ECS/Fargate.
- At least 3 document types ingested: SEC 10-K filings, earnings call transcripts, shareholder letters.
- Hybrid retrieval working: BM25 + pgvector + Cohere Rerank.
- Structured evaluation benchmark: 30–50 questions with ground truth, Precision@5 computed and documented.
- Complete README with architecture diagram, stack table, engineering decisions, eval results, and local run instructions.
- Repo public on GitHub, project on resume with live demo link.

---

## 6. What this project is NOT

- Not a generic PDF chat application. The retrieval pipeline is specifically designed for financial document characteristics (long documents, precise financial terminology, temporal filtering by quarter/year).
- Not a demo-only project. It has a real async ingestion pipeline, a real evaluation benchmark, and production observability via CloudWatch structured logs.
- Not authentication-dependent. V1 is a public demo with rate limiting. Auth is explicitly deferred to V2.

---

## 7. Related documents

- [requirements.md](requirements.md) – V1 feature scope and in/out-of-scope decisions
- [high-level-architecture.md](high-level-architecture.md) – System diagram and component explanation
- [tech-stack-decision.md](tech-stack-decision.md) – Stack choices and rationale
- [developer-tasks.md](developer-tasks.md) – Phased task breakdown with acceptance criteria
- [implementation-milestones.md](implementation-milestones.md) – Milestone-by-milestone build roadmap
