from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    cohere_api_key: str | None = Field(default=None, validation_alias="COHERE_API_KEY")


settings = Settings()
