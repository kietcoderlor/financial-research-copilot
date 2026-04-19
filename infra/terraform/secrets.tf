resource "aws_secretsmanager_secret" "app" {
  name = "${var.project_name}/app-env"
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DB_URL            = "postgresql+asyncpg://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${var.db_name}"
    REDIS_URL         = "rediss://${local.redis_host}:${local.redis_port}/0"
    SQS_QUEUE_URL     = aws_sqs_queue.ingestion.url
    OPENAI_API_KEY    = var.openai_api_key
    ANTHROPIC_API_KEY = var.anthropic_api_key
    COHERE_API_KEY    = var.cohere_api_key
  })

  depends_on = [
    aws_db_instance.main,
    aws_elasticache_serverless_cache.main,
  ]
}
