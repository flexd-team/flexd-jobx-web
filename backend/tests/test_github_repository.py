from contextlib import asynccontextmanager

from sqlalchemy import func, select

from app.configs.database import get_db
from app.main import application
from app.models import Artifact, ArtifactContribution, UserOAuthIdentity
from app.services import github_repository_service
from app.utils.security import create_access_token


async def test_repository_import_and_duplicate(api, monkeypatch):
    async with asynccontextmanager(application.dependency_overrides[get_db])() as db:
        db.add(UserOAuthIdentity(user_id=2, provider="github", provider_user_id="123"))
        await db.commit()

    repo = {
        "id": 456,
        "name": "project",
        "private": False,
        "owner": {"id": 123, "login": "dev", "type": "User"},
    }

    async def fake_get(path, params=None):
        if path == "/user/123":
            return {"id": 123, "login": "dev", "type": "User"}
        if path == "/users/dev/repos":
            return [repo, {**repo, "private": True}]
        assert path == "/repos/dev/project"
        return repo

    monkeypatch.setattr(github_repository_service, "github_get", fake_get)
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    response = await api.get("/api/v1/integrations/github/repositories")
    assert response.status_code == 200
    assert response.json()["data"]["repositories"] == [
        {"id": "456", "name": "project", "owner": "dev"}
    ]
    payload = {
        "repository_id": "456",
        "repository_name": "project",
        "title": "Project",
        "role_title": "Developer",
        "contribution_description": "Built API",
    }
    created = await api.post("/api/v1/artifacts/github/import", json=payload)
    assert created.status_code == 201
    assert created.json()["data"]["artifact"]["processing_status"] == "not_started"
    assert (await api.post("/api/v1/artifacts/github/import", json=payload)).status_code == 409
    async with asynccontextmanager(application.dependency_overrides[get_db])() as db:
        assert await db.scalar(select(func.count()).select_from(Artifact)) == 1
        assert await db.scalar(select(func.count()).select_from(ArtifactContribution)) == 1
    api.headers["Authorization"] = f"Bearer {create_access_token(3)}"
    assert (await api.get("/api/v1/integrations/github/repositories")).status_code == 403


async def test_repository_owner_mismatch_rejected(api, monkeypatch):
    async with asynccontextmanager(application.dependency_overrides[get_db])() as db:
        db.add(UserOAuthIdentity(user_id=2, provider="github", provider_user_id="123"))
        await db.commit()

    async def fake_get(path, params=None):
        if path == "/user/123":
            return {"id": 123, "login": "dev", "type": "User"}
        return {
            "id": 456,
            "name": "project",
            "private": False,
            "owner": {"id": 999, "login": "dev", "type": "User"},
        }

    monkeypatch.setattr(github_repository_service, "github_get", fake_get)
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    response = await api.post(
        "/api/v1/artifacts/github/import",
        json={
            "repository_id": "456",
            "repository_name": "project",
            "title": "Project",
            "role_title": "Developer",
            "contribution_description": "Built API",
        },
    )
    assert response.status_code == 422
