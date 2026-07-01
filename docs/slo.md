# Service Level Objective (local / deferred AWS)

## SLO

**99% of `/query` requests complete within 3 seconds** over a 7-day window on the local Docker stack (excludes cold-start LLM calls without API keys).

## Error budget

- Monthly window: 7 days local validation
- Allowed bad events: 1% of requests > 3s
- Measurement: `perf/query-load-test.js` (k6) against `http://localhost:8000`

## Deferred (requires AWS recovery)

- CloudWatch dashboard widgets (P7-A6)
- ECS auto-scaling on SQS depth (P7-A5)
- SNS alarms for DLQ / RDS CPU (INFRA-3)

When AWS is restored, point the same k6 script at the ALB URL and export p95 to CloudWatch.
