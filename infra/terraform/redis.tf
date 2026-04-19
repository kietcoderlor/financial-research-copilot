resource "aws_elasticache_serverless_cache" "main" {
  engine = "redis"
  name   = "${var.project_name}-redis"

  major_engine_version = "7"
  subnet_ids           = aws_subnet.private[*].id
  security_group_ids   = [aws_security_group.redis.id]

  cache_usage_limits {
    data_storage {
      maximum = 1
      unit    = "GB"
    }
    ecpu_per_seconds {
      maximum = 1000
    }
  }

}

locals {
  redis_host = tolist(aws_elasticache_serverless_cache.main.endpoint)[0].address
  redis_port = tolist(aws_elasticache_serverless_cache.main.endpoint)[0].port
}
