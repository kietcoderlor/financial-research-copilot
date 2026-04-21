# Phase 1 AWS (Terraform)

This stack provisions **P1-2 through P1-15** and **P2-12** (ingestion worker) from `doc/developer-tasks.md`: VPC (2 public + 2 private, NAT), security groups, S3, SQS+DLQ, RDS Postgres 15, ElastiCache Serverless (Redis 7), Secrets Manager (JSON for ECS env), ECR, CloudWatch log group, **two** ECS Fargate services (API behind ALB + **SQS worker**, same image), ALB, and **WAFv2 rate limiting** for API traffic.

**You still do manually**

- **P1-1 IAM**: an IAM principal used for `terraform apply` (and optionally the same keys for GitHub Actions) with permissions to create these resources.
- **P1-5 pgvector**: from a host that can reach RDS (Session Manager bastion, VPN, or temporary SG rule), run `CREATE EXTENSION IF NOT EXISTS vector;` and verify with `SELECT * FROM pg_extension WHERE extname = 'vector';`.
- **First image**: after `terraform apply`, build and push the API image to ECR (`:latest`) so ECS tasks can start (until then the service may show `CannotPullContainerError` or failed health checks).

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) v2
- `aws configure` (region `us-east-1` recommended to match `.github/workflows/deploy.yml`)

### Windows: `terraform` not recognized (PATH)

If `winget install Hashicorp.Terraform` succeeded but **Cursor / PowerShell** still says `terraform` is not recognized:

1. **Easiest (no restart):** from `infra/terraform`, use the wrapper (reloads PATH + finds WinGet install):

   ```powershell
   .\tf.ps1 version
   .\tf.ps1 init
   .\tf.ps1 plan -out=tfplan
   .\tf.ps1 apply tfplan
   ```

2. **Reload PATH in the current terminal**, then try `terraform` again:

   ```powershell
   $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
   terraform version
   ```

3. **Fully restart Cursor** (quit app, reopen) or **sign out of Windows** so integrated terminals inherit the updated User PATH.

To locate the binary after a WinGet install:

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "terraform.exe" | Select-Object -First 1 -ExpandProperty FullName
```

## Apply

```bash
cd infra/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

## If you already created ECR + ECS in the console (GitHub deploy works)

Terraform also defines **ECR**, **ECS cluster**, **ECS service**, **task definition**, and **CloudWatch log group** with the same names. Before the first `terraform apply` you must avoid **name collisions** on the ECS **service** (Terraform must own `aws_ecs_service.api`).

### Step 1 — Delete the manually created ECS service (keep the cluster)

1. **ECS** → cluster `financial-copilot` → service `financial-copilot-api` → **Delete** (check **Force delete** if offered so tasks drain faster).
2. Wait until the service is gone. **Do not** delete the cluster `financial-copilot` if you want to keep the same name (optional: you may delete the whole cluster and skip the cluster import in Step 2).

### Step 2 — Import existing resources into Terraform state

From `infra/terraform` (after `terraform init`):

```bash
terraform import aws_ecr_repository.api financial-copilot-api
terraform import aws_ecs_cluster.main financial-copilot
```

If you already created the log group **`/ecs/financial-copilot`**:

```bash
terraform import aws_cloudwatch_log_group.ecs /ecs/financial-copilot
```

On Windows PowerShell you can run **`.\import-existing-bootstrap.ps1`** in this folder (same commands).

If an import errors with **“cannot import non-existent”**, skip that import and let Terraform create the resource instead.

### Step 3 — Plan and apply

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

This creates the remaining Phase 1 pieces: **VPC, NAT, SGs, S3, SQS, RDS, Redis, Secrets Manager, ALB**, and recreates the **ECS service** attached to the ALB (private subnets, no public task IP). Expect **15–40+ minutes** (RDS/ElastiCache).

### Step 4 — Image and CI

After apply, ensure **`:latest`** exists in ECR (push locally or re-run **Deploy API** on GitHub). Then confirm:

```bash
terraform output alb_dns_name
curl http://$(terraform output -raw alb_dns_name)/health
```

PowerShell:

```powershell
$alb = terraform output -raw alb_dns_name
curl "http://$alb/health"
```

### Step 5 — pgvector (still manual)

Connect to RDS from a host that can reach it, then:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT * FROM pg_extension WHERE extname = 'vector';
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
aws ecs update-service --cluster financial-copilot --service financial-copilot-worker --force-new-deployment --region us-east-1
```

Or push from CI after GitHub secrets are set (workflow updates **both** services).

## Verify

- `terraform output alb_dns_name` then `curl http://<alb>/health`
- CloudWatch log group `/ecs/financial-copilot` — stream prefix **`api`** (FastAPI) and **`worker`** (`python -m app.ingestion.worker`); ECS task role allows **S3 GetObject** on the raw bucket and **SQS** on `ingestion-queue`.
- S3 / SQS: use outputs and the AWS console (`terraform output ecs_worker_service_name`)
- WAF: `terraform output waf_web_acl_arn` should be non-empty; requests above the configured threshold are blocked with HTTP `429`.

## ALB request rate limiting (Phase 5)

WAFv2 is attached to ALB with an IP-based rate rule:

- variable: `alb_rate_limit_per_5m`
- default: `500` requests per 5 minutes (about **100 req/min**)
- action: block + return HTTP `429`

## ECS Exec — kiểm tra RDS / corpus từ trong VPC (không cần bastion VPN)

Terraform bật **`enable_execute_command`** cho service **`financial-copilot-api`** (mặc định `var.project_name = financial-copilot`) và gắn policy **SSM Messages** cho task role. Task API dùng SG **backend** nên **đã kết nối được RDS** giống app.

1. **`terraform apply`** (sau khi pull code mới) để cập nhật cluster + service + IAM.
2. **Build & push image mới** — `Dockerfile` đã `COPY scripts ./scripts` để chạy `python scripts/check_corpus.py` trong container.
3. Trên máy bạn: cài [**Session Manager plugin**](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) (bắt buộc cho `aws ecs execute-command`).
4. IAM user/role bạn dùng cho AWS CLI cần quyền gọi Exec (xem [ECS Exec IAM](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html#ecs-exec-required-iam-permissions)); tài khoản admin thường đủ.

**PowerShell — lấy task id rồi vào shell trong container `api`:**

```powershell
$region = "us-east-1"
$cluster = "financial-copilot"
$service = "financial-copilot-api"
$taskArn = aws ecs list-tasks --cluster $cluster --service-name $service --desired-status RUNNING --region $region --query "taskArns[0]" --output text
aws ecs execute-command --cluster $cluster --task $taskArn --container api --interactive --command "/bin/bash" --region $region
```

Trong container (đã có `DB_URL`, `SQS_QUEUE_URL`, … từ Secrets Manager):

```bash
cd /app && python scripts/check_corpus.py
```

Hoặc `psql` nếu bạn thêm client vào image sau này; hiện tại dùng Python/SQLAlchemy là đủ.

## Troubleshooting failed `apply`

### 1) `AccessDenied` on `elasticloadbalancing:ModifyLoadBalancerAttributes` / `ModifyTargetGroupAttributes`

The IAM user you use for Terraform (e.g. `financial-copilot-cli`) **does not have ELB (v2) permissions**. Terraform needs to create/update load balancers and target groups.

**Quick fix (typical dev account):** in **IAM → Users → (your user) → Add permissions → Attach policies directly**, add the AWS managed policy:

- **`ElasticLoadBalancingFullAccess`**  
  ARN: `arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess`

Then run `.\tf.ps1 apply tfplan` again (or `plan` then `apply`). For production, replace this with a tighter custom policy that only allows the ELB API calls your stack needs.

### 2) `RepositoryAlreadyExistsException` (ECR)

The repository `financial-copilot-api` already exists but is **not in Terraform state**. Import it, then plan/apply:

```powershell
.\tf.ps1 import aws_ecr_repository.api financial-copilot-api
.\tf.ps1 plan -out=tfplan
.\tf.ps1 apply tfplan
```

### 3) ECS `InvalidParameterException` … *idempotent* … *inconsistent arguments*

A cluster named `financial-copilot` **already exists** (often created earlier in the Console with different options than Terraform’s `CreateCluster` body). **Import** the cluster into state:

```powershell
.\tf.ps1 import aws_ecs_cluster.main financial-copilot
.\tf.ps1 plan -out=tfplan
.\tf.ps1 apply tfplan
```

### 4) ALB / target group left over from a **partial** apply

If Terraform (or you) already created an ALB / target group in AWS and plans keep failing until state matches AWS, import using the **ARNs from the error message**:

```powershell
.\tf.ps1 import aws_lb.main "arn:aws:elasticloadbalancing:us-east-1:177697910430:loadbalancer/app/financial-copilot-alb/eaa72dcda779f509"
.\tf.ps1 import aws_lb_target_group.api "arn:aws:elasticloadbalancing:us-east-1:177697910430:targetgroup/financial-copilot-api-tg/cb95e8d780ab18e3"
```

(Replace account ID / suffixes if yours differ.) After **(1)** IAM is fixed, you may not need these imports unless state and AWS diverged.

## Costs

NAT Gateway, RDS, ElastiCache Serverless, Fargate, and ALB incur charges. Run `terraform destroy` in a dev account when finished experimenting.

## Notes

- S3 bucket name includes a short random suffix (global uniqueness).
- `REDIS_URL` in Secrets Manager uses `rediss://` (TLS). Later phases should use a Redis client that supports TLS if you hit connection errors.
- ALB uses **two public subnets** (two AZs); this is required for AWS Application Load Balancers even where the written spec mentions a single public subnet.
