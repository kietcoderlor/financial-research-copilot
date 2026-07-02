from urllib.parse import urlparse

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _sqs_endpoint_from_queue_url(queue_url: str) -> str | None:
    p = urlparse(queue_url)
    host = (p.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "elasticmq", "host.docker.internal"):
        return f"{p.scheme}://{p.netloc}"
    return None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "financial-research-copilot"
    app_env: str = Field(default="development", validation_alias="APP_ENV")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    db_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/copilot",
        validation_alias="DB_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379", validation_alias="REDIS_URL")

    aws_region: str = Field(default="us-east-1", validation_alias="AWS_REGION")
    sqs_queue_url: str = Field(
        default="http://localhost:9324/000000000000/ingestion-queue",
        validation_alias="SQS_QUEUE_URL",
    )
    s3_bucket: str = Field(
        default="financial-copilot-raw-docs",
        validation_alias="S3_BUCKET",
    )
    sqs_endpoint_url: str | None = Field(default=None, validation_alias="SQS_ENDPOINT_URL")
    s3_endpoint_url: str | None = Field(default=None, validation_alias="S3_ENDPOINT_URL")

    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    cohere_api_key: str | None = Field(default=None, validation_alias="COHERE_API_KEY")

    query_cache_ttl_seconds: int = Field(default=3600, validation_alias="QUERY_CACHE_TTL_SECONDS")
    semantic_cache_threshold: float = Field(default=0.92, validation_alias="SEMANTIC_CACHE_THRESHOLD")

    sec_edgar_company_name: str = Field(
        default="FinancialResearchCopilot",
        validation_alias="SEC_EDGAR_COMPANY_NAME",
    )
    sec_edgar_contact_email: str = Field(
        default="admin@example.com",
        validation_alias="SEC_EDGAR_CONTACT_EMAIL",
    )

    jwt_secret: str = Field(
        default="dev-change-me-in-production-use-long-random-string",
        validation_alias="JWT_SECRET",
    )
    jwt_expire_days: int = Field(default=7, validation_alias="JWT_EXPIRE_DAYS")

    google_client_id: str | None = Field(default=None, validation_alias="GOOGLE_CLIENT_ID")

    smtp_host: str | None = Field(default=None, validation_alias="SMTP_HOST")
    smtp_port: int = Field(default=587, validation_alias="SMTP_PORT")
    smtp_user: str | None = Field(default=None, validation_alias="SMTP_USER")
    smtp_password: str | None = Field(default=None, validation_alias="SMTP_PASSWORD")
    smtp_from: str | None = Field(default=None, validation_alias="SMTP_FROM")
    smtp_use_tls: bool = Field(default=True, validation_alias="SMTP_USE_TLS")

    auth_otp_ttl_seconds: int = Field(default=600, validation_alias="AUTH_OTP_TTL_SECONDS")
    auth_otp_rate_limit_per_hour: int = Field(default=5, validation_alias="AUTH_OTP_RATE_LIMIT_PER_HOUR")
    auth_otp_dev_expose: bool = Field(default=True, validation_alias="AUTH_OTP_DEV_EXPOSE")
    query_auth_required: bool = Field(default=True, validation_alias="QUERY_AUTH_REQUIRED")

    @property
    def resolved_sqs_endpoint_url(self) -> str | None:
        if self.sqs_endpoint_url:
            return self.sqs_endpoint_url
        return _sqs_endpoint_from_queue_url(self.sqs_queue_url)


settings = Settings()
