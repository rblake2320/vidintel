"""Integration tests for the FastAPI application."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

# A valid-looking JWT for testing (we mock the auth dependency)
TEST_USER_ID = str(uuid.uuid4())


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer fake-test-token"}


@pytest.fixture
def mock_auth():
    """Override the auth dependency to return a test user."""
    from app.routers.auth import get_current_user

    async def _override():
        return TEST_USER_ID

    app.dependency_overrides[get_current_user] = _override
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def mock_db():
    """Override the DB dependency with a mock async session that returns sync results."""
    from unittest.mock import MagicMock

    from app.db.database import get_db

    class FakeResult:
        """Sync result object that scalar_one_or_none can return None from."""
        def scalar_one_or_none(self):
            return None
        def scalars(self):
            return self
        def all(self):
            return []

    class FakeSession:
        """Fake async session that awaits execute and returns FakeResult."""
        async def execute(self, *args, **kwargs):
            return FakeResult()
        async def commit(self):
            pass
        async def rollback(self):
            pass
        async def flush(self):
            pass
        def add(self, obj):
            pass

    fake_session = FakeSession()

    async def _override():
        yield fake_session

    app.dependency_overrides[get_db] = _override
    yield fake_session
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_process_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/process",
            json={
                "source": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "source_type": "youtube",
                "output_format": "bullets",
            },
        )
    # FastAPI's HTTPBearer returns 401 when no credentials are provided
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_process_invalid_format(mock_auth, auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/process",
            headers=auth_headers,
            json={
                "source": "some text",
                "source_type": "paste",
                "output_format": "invalid_format",
            },
        )
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_process_empty_source(mock_auth, auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/process",
            headers=auth_headers,
            json={
                "source": "",
                "source_type": "paste",
                "output_format": "bullets",
            },
        )
    assert response.status_code == 422  # min_length=1 validation


@pytest.mark.asyncio
async def test_get_job_not_found(mock_auth, mock_db, auth_headers):
    """Getting a non-existent job returns 404 when DB returns no rows."""
    # FakeSession.execute already returns FakeResult with scalar_one_or_none = None
    fake_id = uuid.uuid4()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            f"/api/jobs/{fake_id}",
            headers=auth_headers,
        )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_sessions_list_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/sessions")
    assert response.status_code == 401
