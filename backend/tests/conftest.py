"""Pytest configuration and shared fixtures."""

import os

# Ensure test environment
os.environ.setdefault("APP_ENV", "testing")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-key-for-testing-only")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/vidintel_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")
