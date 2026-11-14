"""Database operations for GitHub identity; OAuth verification belongs to caller."""

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserOAuthIdentity
from app.services.github_client import GitHubIdentity
from app.utils.database_errors import translate_database_error
from app.utils.exceptions import AppError


async def find_github_user(db: AsyncSession, identity: GitHubIdentity) -> User | None:
    user = await db.scalar(
        select(User)
        .join(UserOAuthIdentity, User.id == UserOAuthIdentity.user_id)
        .where(
            UserOAuthIdentity.provider == "github",
            UserOAuthIdentity.provider_user_id == identity.provider_user_id,
        )
    )
    if user is not None and user.account_status != "active":
        raise AppError(401, "Authentication failed", {"auth": "Account is unavailable"})
    return user


async def register_github_user(db: AsyncSession, identity: GitHubIdentity, role: str) -> User:
    if role not in ("candidate", "employer"):
        raise AppError(422, "Validation failed", {"account_type": "Invalid account type"})
    if not identity.email:
        raise AppError(422, "Validation failed", {"email": "Verified GitHub email required"})
    try:
        if await find_github_user(db, identity):
            raise AppError(409, "Resource conflict", {"auth": "GitHub identity already linked"})
        if await db.scalar(select(User.id).where(User.email == identity.email)) is not None:
            raise AppError(409, "Resource conflict", {"email": "Sign in to link existing account"})
        user = User(
            name=identity.name,
            email=identity.email,
            password_hash=None,
            account_type=role,
            account_status="active",
        )
        db.add(user)
        await db.flush()
        db.add(
            UserOAuthIdentity(
                user_id=user.id, provider="github", provider_user_id=identity.provider_user_id
            )
        )
        await db.flush()
        await db.refresh(user)
        await db.commit()
        return user
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "auth") from exc
    except Exception:
        await db.rollback()
        raise


async def link_github_user(db: AsyncSession, user_id: int, identity: GitHubIdentity) -> None:
    try:
        user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
        if user is None or user.account_status != "active":
            raise AppError(401, "Authentication failed", {"auth": "Account is unavailable"})
        db.add(
            UserOAuthIdentity(
                user_id=user_id, provider="github", provider_user_id=identity.provider_user_id
            )
        )
        await db.flush()
        await db.commit()
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "auth") from exc
    except Exception:
        await db.rollback()
        raise


async def unlink_github_user(db: AsyncSession, user_id: int) -> None:
    try:
        user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
        if user is None or user.account_status != "active":
            raise AppError(401, "Authentication failed", {"auth": "Account is unavailable"})
        identity = await db.scalar(
            select(UserOAuthIdentity).where(
                UserOAuthIdentity.user_id == user_id, UserOAuthIdentity.provider == "github"
            )
        )
        if identity is None:
            raise AppError(404, "GitHub identity not found", {"auth": "Not linked"})
        if not user.password_hash:
            raise AppError(409, "Resource conflict", {"auth": "Cannot remove only login method"})
        await db.delete(identity)
        await db.commit()
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "auth") from exc
    except Exception:
        await db.rollback()
        raise
