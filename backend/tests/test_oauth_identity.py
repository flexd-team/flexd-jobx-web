from contextlib import asynccontextmanager

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, OperationalError

from app.configs.database import get_db
from app.main import application
from app.models import User, UserOAuthIdentity
from app.utils.security import create_access_token


def test_oauth_schema_contract():
    table = UserOAuthIdentity.__table__
    assert User.__table__.c.password_hash.nullable
    assert set(table.columns.keys()) == {
        "id",
        "user_id",
        "provider",
        "provider_user_id",
        "created_at",
    }
    assert table.c.provider.type.enums == ["github"]
    assert table.c.user_id.type.unsigned
    assert next(iter(table.c.user_id.foreign_keys)).ondelete == "CASCADE"


async def test_oauth_only_password_auth_fails_safely(api):
    async with asynccontextmanager(application.dependency_overrides[get_db])() as db:
        db.add(
            User(
                id=4,
                name="GitHub candidate",
                email="oauth@example.com",
                password_hash=None,
                account_type="candidate",
                account_status="active",
            )
        )
        await db.commit()

    response = await api.post(
        "/api/v1/auth/login",
        json={"email": "oauth@example.com", "password": "some-password-123"},
    )
    assert response.status_code == 401
    assert response.json()["error"] == {"auth": "Invalid email or password"}
    assert response.json()["data"] == {}

    api.headers["Authorization"] = f"Bearer {create_access_token(4)}"
    me = await api.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert "password_hash" not in me.text
    changed = await api.patch(
        "/api/v1/auth/password",
        json={"current_password": "some-password-123", "new_password": "new-password-123"},
    )
    assert changed.status_code == 422
    assert changed.json()["error"] == {"current_password": "Password does not match"}
    async with asynccontextmanager(application.dependency_overrides[get_db])() as db:
        assert (await db.get(User, 4)).password_hash is None


async def test_identity_constraints_and_user_delete_cascade(api):
    async with asynccontextmanager(application.dependency_overrides[get_db])() as db:
        db.add(UserOAuthIdentity(user_id=2, provider="github", provider_user_id="123456"))
        await db.commit()
        identity = await db.scalar(select(UserOAuthIdentity))
        assert identity.created_at is not None

        # One GitHub identity cannot belong to two JobX accounts.
        db.add(UserOAuthIdentity(user_id=3, provider="github", provider_user_id="123456"))
        with pytest.raises(IntegrityError):
            await db.commit()
        await db.rollback()

        # One JobX account cannot hold two identities for the same provider.
        db.add(UserOAuthIdentity(user_id=2, provider="github", provider_user_id="789012"))
        with pytest.raises(IntegrityError):
            await db.commit()
        await db.rollback()

        db.add(UserOAuthIdentity(user_id=999, provider="github", provider_user_id="789012"))
        # SQLite driver versions classify FK violations differently.
        with pytest.raises(
            (IntegrityError, OperationalError), match="FOREIGN KEY constraint failed"
        ):
            await db.commit()
        await db.rollback()
        assert len(list(await db.scalars(select(UserOAuthIdentity)))) == 1

        await db.execute(delete(User).where(User.id == 2))
        await db.commit()
        assert await db.scalar(select(UserOAuthIdentity)) is None
