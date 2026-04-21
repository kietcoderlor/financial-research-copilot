variable "aws_region" {
  type        = string
  description = "AWS region (GitHub Actions deploy workflow uses us-east-1)."
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Prefix for resource names."
  default     = "financial-copilot"
}

variable "db_name" {
  type        = string
  description = "Postgres database name."
  default     = "copilot"
}

variable "db_username" {
  type        = string
  description = "Postgres master username."
  default     = "postgres"
}

variable "openai_api_key" {
  type        = string
  description = "Stored in Secrets Manager (can be empty until Phase 2+)."
  default     = ""
  sensitive   = true
}

variable "anthropic_api_key" {
  type        = string
  description = "Stored in Secrets Manager (optional until later phases)."
  default     = ""
  sensitive   = true
}

variable "cohere_api_key" {
  type        = string
  description = "Stored in Secrets Manager (optional until later phases)."
  default     = ""
  sensitive   = true
}

variable "alb_rate_limit_per_5m" {
  type        = number
  description = "WAFv2 rate limit window is 5 minutes. 500 = ~100 req/min."
  default     = 500
}
