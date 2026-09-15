import pytest
from httpx import AsyncClient, ASGITransport
from apps.api.app.main import app
from apps.api.app.database import init_db

@pytest.fixture(autouse=True)
async def initialize_test_database():
    await init_db()

@pytest.mark.asyncio
async def test_health_and_capabilities():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"

        cap_res = await client.get("/api/capabilities")
        assert cap_res.status_code == 200
        data = cap_res.json()
        assert "groq" in data
        assert "embeddings" in data
        assert data["embeddings"]["dimensions"] == 384

@pytest.mark.asyncio
async def test_create_and_list_demo_repo():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create demo repo
        create_res = await client.post(
            "/api/repositories",
            json={"url": "https://github.com/demo/sample-repo", "branch": "main"}
        )
        assert create_res.status_code == 200
        body = create_res.json()
        assert "repository_id" in body
        assert "job_id" in body

        # List repos
        list_res = await client.get("/api/repositories")
        assert list_res.status_code == 200
        repos = list_res.json()
        assert len(repos) >= 1
        assert any("demo" in r["full_name"] for r in repos)
