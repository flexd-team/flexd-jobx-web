import pytest
from pydantic import TypeAdapter, ValidationError

from app.configs.settings import Settings
from app.models import Base
from app.schemas.common import UnsignedId


def test_settings_and_metadata():
    settings = Settings(_env_file=None, db_password="p@ss:/word", db_tls_enabled=False)
    assert settings.database_url.password == "p@ss:/word"
    assert settings.db_tls_enabled is False
    assert not hasattr(settings, "llm_provider")
    assert len(Base.metadata.tables) == 13
    assert list(Base.metadata.tables["candidate_profile"].primary_key.columns)[0].name == "user_id"
    assert (
        TypeAdapter(UnsignedId).dump_json(18_446_744_073_709_551_615) == b'"18446744073709551615"'
    )


def test_weak_secret_rejected():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, jwt_secret_key="weak")


def test_github_settings_optional_and_secret_redacted():
    settings = Settings(_env_file=None, app_github_client_secret="test-secret")
    assert settings.app_github_client_secret.get_secret_value() == "test-secret"
    assert "test-secret" not in repr(settings)
    assert "test-secret" not in settings.model_dump_json()
    assert settings.app_github_callback_url == "http://localhost:8000/api/v1/auth/github/callback"


async def test_http_errors_keep_envelope(api):
    response = await api.get("/api/v1/missing")
    assert response.status_code == 404
    assert set(response.json()) == {"message", "error", "data"}
    assert response.json()["data"] == {}
