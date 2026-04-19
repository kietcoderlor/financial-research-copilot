# Run from infra/terraform after: terraform init
# Prerequisite: delete the manually created ECS *service* financial-copilot-api (see README.md).
#
# Optional: if log group /ecs/financial-copilot already exists:
#   terraform import aws_cloudwatch_log_group.ecs /ecs/financial-copilot

$ErrorActionPreference = "Stop"

Write-Host "Importing ECR repository + ECS cluster into Terraform state..." -ForegroundColor Cyan
terraform import aws_ecr_repository.api financial-copilot-api
terraform import aws_ecs_cluster.main financial-copilot

Write-Host "Done. Next: terraform plan -out=tfplan" -ForegroundColor Green
Write-Host "Then: terraform apply tfplan" -ForegroundColor Green
