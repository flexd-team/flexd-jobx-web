"""Public GitHub repository import; never fetch arbitrary URLs or private repositories."""

import re

import httpx
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Artifact, ArtifactContribution, User, UserOAuthIdentity
from app.utils.database_errors import translate_database_error
from app.utils.exceptions import AppError

NAME = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")


def candidate(user: User):
    if user.account_type != "candidate":
        raise AppError(403, "Access denied", {"auth": "Candidate access required"})


async def github_id(db: AsyncSession, user: User) -> str:
    candidate(user)
    identity = await db.scalar(
        select(UserOAuthIdentity).where(
            UserOAuthIdentity.user_id == user.id, UserOAuthIdentity.provider == "github"
        )
    )
    if identity is None:
        raise AppError(409, "Resource conflict", {"github": "Connect GitHub first"})
    return identity.provider_user_id


async def github_get(path: str, params: dict | None = None):
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=10) as client:
            response = await client.get(
                "https://api.github.com" + path,
                params=params,
                headers={"Accept": "application/vnd.github+json"},
            )
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise AppError(
            502, "GitHub request failed", {"github": "Unable to fetch repository"}
        ) from exc


async def get_owner(provider_id: str):
    if not provider_id.isascii() or not provider_id.isdecimal():
        raise AppError(422, "Validation failed", {"github": "Invalid GitHub identity"})
    owner = await github_get(f"/user/{provider_id}")
    if (
        not isinstance(owner, dict)
        or str(owner.get("id")) != provider_id
        or owner.get("type") != "User"
        or not isinstance(owner.get("login"), str)
        or not NAME.fullmatch(owner["login"])
    ):
        raise AppError(502, "GitHub request failed", {"github": "Invalid GitHub identity"})
    return owner["login"]


def public_repo(repo, provider_id: str):
    if not isinstance(repo, dict) or not isinstance(repo.get("owner"), dict):
        return False
    owner = repo["owner"]
    return (
        repo.get("private") is False
        and owner.get("type") == "User"
        and str(owner.get("id")) == provider_id
        and type(repo.get("id")) is int
        and repo["id"] > 0
        and isinstance(repo.get("name"), str)
        and NAME.fullmatch(repo["name"]) is not None
        and isinstance(owner.get("login"), str)
        and NAME.fullmatch(owner["login"]) is not None
    )


async def list_repositories(db: AsyncSession, user: User, page: int, per_page: int):
    provider_id = await github_id(db, user)
    login = await get_owner(provider_id)
    items = await github_get(
        f"/users/{login}/repos", {"type": "owner", "page": page, "per_page": per_page}
    )
    if not isinstance(items, list):
        raise AppError(502, "GitHub request failed", {"github": "Invalid repository response"})
    return [
        {"id": str(r["id"]), "name": r["name"], "owner": r["owner"]["login"]}
        for r in items
        if public_repo(r, provider_id)
    ]


async def import_repository(db: AsyncSession, user: User, schema):
    provider_id = await github_id(db, user)
    login = await get_owner(provider_id)
    repo = await github_get(f"/repos/{login}/{schema.repository_name}")
    if not public_repo(repo, provider_id) or str(repo["id"]) != schema.repository_id:
        raise AppError(422, "Validation failed", {"repository": "Public owned repository required"})
    source_url = f"https://github.com/{repo['owner']['login']}/{repo['name']}"
    try:
        # Lock owner to serialize imports for the same candidate on MySQL.
        await db.scalar(select(User).where(User.id == user.id).with_for_update())
        existing = await db.scalar(
            select(Artifact.id).where(
                Artifact.owner_user_id == user.id,
                Artifact.artifact_type == "github_repository",
                Artifact.source_url == source_url,
            )
        )
        if existing is not None:
            raise AppError(409, "Resource conflict", {"repository": "Already imported"})
        prior = await db.scalars(
            select(Artifact.metadata_json).where(
                Artifact.owner_user_id == user.id, Artifact.artifact_type == "github_repository"
            )
        )
        if any(
            isinstance(value, dict) and value.get("github_repository_id") == str(repo["id"])
            for value in prior
        ):
            raise AppError(409, "Resource conflict", {"repository": "Already imported"})
        artifact = Artifact(
            owner_user_id=user.id,
            title=schema.title,
            description=schema.description,
            artifact_type="github_repository",
            source_url=source_url,
            visibility=schema.visibility,
            processing_status="not_started",
            metadata_json={"github_repository_id": str(repo["id"])},
        )
        db.add(artifact)
        await db.flush()
        db.add(
            ArtifactContribution(
                artifact_id=artifact.id,
                contributor_user_id=user.id,
                role_title=schema.role_title,
                contribution_description=schema.contribution_description,
            )
        )
        await db.flush()
        await db.refresh(artifact)
        await db.commit()
        return artifact
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "artifact") from exc
    except Exception:
        await db.rollback()
        raise
