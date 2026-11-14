from contextlib import asynccontextmanager

import pytest
from sqlalchemy import func, select

from app.configs.database import get_db
from app.main import application
from app.models import User
from app.services.github_client import GitHubIdentity
from app.services.github_identity_service import (
    find_github_user,
    link_github_user,
    register_github_user,
    unlink_github_user,
)
from app.utils.exceptions import AppError


async def test_register_and_prevent_unlink_of_only_login(api):
    async with asynccontextmanager(application.dependency_overrides[get_db])() as db:
        identity = GitHubIdentity("100", "Candidate", "github@example.com")
        user = await register_github_user(db, identity, "candidate")
        assert user.password_hash is None
        assert (await find_github_user(db, identity)).id == user.id
        with pytest.raises(AppError) as error:
            await unlink_github_user(db, user.id)
        assert error.value.status_code == 409


async def test_no_email_merge_and_link_conflict(api):
    async with asynccontextmanager(application.dependency_overrides[get_db])() as db:
        identity = GitHubIdentity("101", "Candidate", "candidate@example.com")
        before = await db.scalar(select(func.count()).select_from(User))
        with pytest.raises(AppError) as error:
            await register_github_user(db, identity, "candidate")
        assert error.value.status_code == 409
        assert await db.scalar(select(func.count()).select_from(User)) == before
        await link_github_user(db, 2, identity)
        with pytest.raises(AppError) as error:
            await link_github_user(db, 3, identity)
        assert error.value.status_code == 409
        assert (await find_github_user(db, identity)).id == 2
        await unlink_github_user(db, 2)
        assert await find_github_user(db, identity) is None


async def test_unverified_email_and_admin_role_rejected(api):
    async with asynccontextmanager(application.dependency_overrides[get_db])() as db:
        with pytest.raises(AppError):
            await register_github_user(db, GitHubIdentity("102", "User", None), "candidate")
        with pytest.raises(AppError):
            await register_github_user(db, GitHubIdentity("102", "User", "x@example.com"), "admin")
