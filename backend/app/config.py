"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str = "changeme-256bit"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://redteam:redteam@localhost:5432/vidintel"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # LLM
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""

    # Sentry
    SENTRY_DSN: str = ""

    # Rate limiting
    RATE_LIMIT_FREE: str = "10/hour"
    RATE_LIMIT_IP: str = "20/hour"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
