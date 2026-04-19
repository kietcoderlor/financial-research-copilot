output "alb_dns_name" {
  description = "Open http://<this>/health after the first image is pushed to ECR."
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "docker tag && docker push target."
  value       = aws_ecr_repository.api.repository_url
}

output "s3_bucket_raw" {
  value = aws_s3_bucket.raw.bucket
}

output "sqs_queue_url" {
  value = aws_sqs_queue.ingestion.url
}

output "secrets_manager_secret_arn" {
  description = "ECS reads JSON keys from this secret."
  value       = aws_secretsmanager_secret.app.arn
}

output "rds_address" {
  value = aws_db_instance.main.address
}

output "redis_hint" {
  description = "REDIS_URL is written to Secrets Manager (rediss://)."
  value       = "See Secrets Manager: ${aws_secretsmanager_secret.app.name}"
}

output "next_steps" {
  description = "Post-apply checklist."
  value       = <<-EOT
    1) Authenticate Docker to ECR, build the API image, tag :latest, and push (see infra/terraform/README.md).
    2) After the image exists, ECS tasks should pass health checks; verify: curl http://${aws_lb.main.dns_name}/health
    3) Enable pgvector on RDS from a host that can reach the DB (bastion/VPN): CREATE EXTENSION IF NOT EXISTS vector;
    4) Add GitHub Actions secrets AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY for deploy.yml.
  EOT
}
