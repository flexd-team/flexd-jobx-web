from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.auth import ChangePassword, Login, Register
from app.utils.database_errors import translate_database_error
from app.utils.exceptions import AppError
from app.utils.security import create_access_token, dummy_hash, hash_password, verify_password


async def register(db: AsyncSession, schema: Register) -> User:
    try:
        user = User(
            name=schema.name.strip(),
            email=str(schema.email).lower(),
            password_hash=hash_password(schema.password),
            account_type=schema.account_type,
            account_status="active",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        await db.commit()
        return user
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "user") from exc
    except Exception:
        await db.rollback()
        raise


async def login(db: AsyncSession, schema: Login) -> tuple[User, str]:
    user = await db.scalar(select(User).where(User.email == str(schema.email).lower()))
    stored_hash = user.password_hash if user else None
    valid = verify_password(schema.password, stored_hash or dummy_hash())
    if user is None or not stored_hash or not valid or user.account_status != "active":
        raise AppError(401, "Authentication failed", {"auth": "Invalid email or password"})
    return user, create_access_token(user.id)


async def change_password(db: AsyncSession, user_id: int, schema: ChangePassword):
    try:
        user = await db.scalar(
            select(User)
            .where(User.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if user is None or user.account_status != "active":
            raise AppError(401, "Authentication failed", {"auth": "Account is unavailable"})
        valid = verify_password(schema.current_password, user.password_hash or dummy_hash())
        if not user.password_hash or not valid:
            raise AppError(
                422, "Validation failed", {"current_password": "Password does not match"}
            )
        if schema.current_password == schema.new_password:
            raise AppError(
                422, "Validation failed", {"new_password": "Choose a different password"}
            )
        user.password_hash = hash_password(schema.new_password)
        await db.commit()
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "user") from exc
    except Exception:
        await db.rollback()
        raise
