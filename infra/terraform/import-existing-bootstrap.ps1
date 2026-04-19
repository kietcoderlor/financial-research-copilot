# Run from infra/terraform after: .\tf.ps1 init
# Prerequisite: delete the manually created ECS *service* financial-copilot-api (see README.md).
#
# Optional: if log group /ecs/financial-copilot already exists:
#   .\tf.ps1 import aws_cloudwatch_log_group.ecs /ecs/financial-copilot

$ErrorActionPreference = "Stop"
$tf = Join-Path $PSScriptRoot "tf.ps1"

Write-Host "Importing ECR repository + ECS cluster into Terraform state..." -ForegroundColor Cyan
& $tf import aws_ecr_repository.api financial-copilot-api
& $tf import aws_ecs_cluster.main financial-copilot

Write-Host "Done. Next: .\tf.ps1 plan -out=tfplan" -ForegroundColor Green
Write-Host "Then: .\tf.ps1 apply tfplan" -ForegroundColor Green
