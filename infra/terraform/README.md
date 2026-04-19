# Phase 1 AWS (Terraform)

This stack provisions **P1-2 through P1-15** from `doc/developer-tasks.md`: VPC (2 public + 2 private, NAT), security groups, S3, SQS+DLQ, RDS Postgres 15, ElastiCache Serverless (Redis 7), Secrets Manager (JSON for ECS env), ECR, CloudWatch log group, ECS Fargate + ALB.

**You still do manually**

- **P1-1 IAM**: an IAM principal used for `terraform apply` (and optionally the same keys for GitHub Actions) with permissions to create these resources.
- **P1-5 pgvector**: from a host that can reach RDS (Session Manager bastion, VPN, or temporary SG rule), run `CREATE EXTENSION IF NOT EXISTS vector;` and verify with `SELECT * FROM pg_extension WHERE extname = 'vector';`.
- **First image**: after `terraform apply`, build and push the API image to ECR (`:latest`) so ECS tasks can start (until then the service may show `CannotPullContainerError` or failed health checks).

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) v2
- `aws configure` (region `us-east-1` recommended to match `.github/workflows/deploy.yml`)

## Apply

```bash
cd infra/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Optional keys (stored in Secrets Manager, read by ECS):

```bash
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars
terraform apply
```

## Push Docker image to ECR

Replace `ACCOUNT_ID` and region if needed:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker build -t financial-copilot-api:latest ../../
docker tag financial-copilot-api:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/financial-copilot-api:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/financial-copilot-api:latest
aws ecs update-service --cluster financial-copilot --service financial-copilot-api --force-new-deployment --region us-east-1
```

Or push from CI after GitHub secrets are set.

## Verify

- `terraform output alb_dns_name` then `curl http://<alb>/health`
- CloudWatch log group `/ecs/financial-copilot` — Logs Insights on JSON fields from the app middleware
- S3 / SQS: use outputs and the AWS console

## Costs

NAT Gateway, RDS, ElastiCache Serverless, Fargate, and ALB incur charges. Run `terraform destroy` in a dev account when finished experimenting.

## Notes

- S3 bucket name includes a short random suffix (global uniqueness).
- `REDIS_URL` in Secrets Manager uses `rediss://` (TLS). Later phases should use a Redis client that supports TLS if you hit connection errors.
- ALB uses **two public subnets** (two AZs); this is required for AWS Application Load Balancers even where the written spec mentions a single public subnet.
