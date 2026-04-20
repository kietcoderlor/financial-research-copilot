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

    sec_edgar_company_name: str = Field(
        default="FinancialResearchCopilot",
        validation_alias="SEC_EDGAR_COMPANY_NAME",
    )
    sec_edgar_contact_email: str = Field(
        default="admin@example.com",
        validation_alias="SEC_EDGAR_CONTACT_EMAIL",
    )

    @property
    def resolved_sqs_endpoint_url(self) -> str | None:
        if self.sqs_endpoint_url:
            return self.sqs_endpoint_url
        return _sqs_endpoint_from_queue_url(self.sqs_queue_url)


settings = Settings()
