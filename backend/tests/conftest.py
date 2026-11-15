import os

os.environ["JWT_SECRET_KEY"] = "test-only-secret-key-at-least-32-characters"
os.environ["APP_ENV"] = "test"

import httpx  # noqa: E402
import pytest_asyncio  # noqa: E402
from pydantic import SecretStr  # noqa: E402
from sqlalchemy import Integer, event  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.schema import MetaData  # noqa: E402
from sqlalchemy.types import JSON, DateTime, Text  # noqa: E402

from app.configs.database import get_db  # noqa: E402
from app.configs.settings import get_settings  # noqa: E402
from app.main import app, application  # noqa: E402
from app.models import Base, User  # noqa: E402
from app.utils.rate_limit import attempts, register_attempts  # noqa: E402
from app.utils.security import create_access_token, hash_password  # noqa: E402


@pytest_asyncio.fixture
async def api(monkeypatch):
    """Portable behavioral tests. Never connects to configured application database."""
    monkeypatch.setattr(get_settings(), "llm_api_key", SecretStr(""))
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    @event.listens_for(engine.sync_engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    metadata = MetaData()
    for table in Base.metadata.sorted_tables:
        table.to_metadata(metadata)
    for table in metadata.tables.values():
        for column in table.columns:
            name = type(column.type).__name__
            if name == "BIGINT":
                column.type = Integer()
            elif name == "DATETIME":
                column.type = DateTime()
            elif name == "LONGTEXT":
                column.type = Text()
            elif name == "JSON":
                column.type = JSON(none_as_null=True)
    async with engine.begin() as connection:
        await connection.run_sync(metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        db.add(
            User(
                id=1,
                name="Admin",
                email="admin@example.com",
                account_type="admin",
                account_status="active",
                password_hash=hash_password("admin-password-123"),
            )
        )
        db.add(
            User(
                id=2,
                name="Candidate",
                email="candidate@example.com",
                account_type="candidate",
                account_status="active",
                password_hash=hash_password("candidate-password-123"),
            )
        )
        db.add(
            User(
                id=3,
                name="Employer",
                email="employer@example.com",
                account_type="employer",
                account_status="active",
                password_hash=hash_password("employer-password-123"),
            )
        )
        await db.commit()

    async def override_db():
        async with factory() as db:
            try:
                yield db
            finally:
                await db.rollback()

    application.dependency_overrides[get_db] = override_db
    attempts.clear()
    register_attempts.clear()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        client.headers["Authorization"] = f"Bearer {create_access_token(1)}"
        yield client
    application.dependency_overrides.clear()
    await engine.dispose()
