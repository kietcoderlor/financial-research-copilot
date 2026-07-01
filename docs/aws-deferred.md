# AWS-only tasks (deferred until account recovery)

These items from INFRA / P7-A require a live AWS account:

| Task | Description |
|------|-------------|
| INFRA-2 | AWS Budget alert + CloudWatch `LLMCostUSD` dashboard |
| INFRA-3 | SNS alarms (ECS unhealthy, DLQ > 0, RDS CPU, LLM cost) |
| P7-A5 | ECS worker auto-scaling on SQS depth |
| P7-A6 | CloudWatch dashboard `financial-copilot-prod` |

## Local substitutes implemented

- LLM cost computed in `app/core/pricing.py` and logged per request
- k6 load test: `perf/query-load-test.js`
- SLO doc: `docs/slo.md` (local targets)
- MinIO + ElasticMQ replace S3 + SQS in `docker-compose.yml`

## Recovery checklist

1. Resolve AWS Support case / billing
2. `cd infra/terraform && terraform apply`
3. Update Vercel `API_BASE_URL` to new ALB DNS
4. Re-run `scripts/seed_corpus.py` against production bucket
5. Enable deferred monitoring tasks above
