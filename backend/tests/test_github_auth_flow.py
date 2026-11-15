from urllib.parse import parse_qs, urlparse

import pytest

from app.configs.settings import get_settings
from app.services.github_client import GitHubClient, GitHubIdentity


@pytest.fixture
def github_config(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "app_github_client_id", "test-client")
    from pydantic import SecretStr

    monkeypatch.setattr(settings, "app_github_client_secret", SecretStr("test-secret"))
    monkeypatch.setattr(settings, "app_env", "test")


async def test_github_register_then_login_and_replay(api, github_config, monkeypatch):
    async def identity(self, code, verifier):
        assert code == "provider-code"
        assert len(verifier) >= 43
        return GitHubIdentity("12345", "GitHub User", "github@example.com")

    monkeypatch.setattr(GitHubClient, "exchange_identity", identity)

    async def authorize_callback():
        start = await api.post("/api/v1/auth/github/authorize")
        assert start.status_code == 200
        url = start.json()["data"]["authorization_url"]
        state = parse_qs(urlparse(url).query)["state"][0]
        callback = await api.get(
            "/api/v1/auth/github/callback", params={"state": state, "code": "provider-code"}
        )
        assert callback.status_code == 303
        assert "provider-code" not in callback.headers["location"]
        handoff = parse_qs(urlparse(callback.headers["location"]).query)["code"][0]
        replay = await api.get(
            "/api/v1/auth/github/callback", params={"state": state, "code": "provider-code"}
        )
        assert replay.status_code == 400
        return handoff

    handoff = await authorize_callback()
    result = await api.post("/api/v1/auth/github/exchange", json={"code": handoff})
    assert result.status_code == 200
    registration_code = result.json()["data"]["registration_code"]
    assert (
        await api.post("/api/v1/auth/github/exchange", json={"code": handoff})
    ).status_code == 400
    registration = await api.post(
        "/api/v1/auth/github/register",
        json={"code": registration_code, "account_type": "candidate"},
    )
    assert registration.status_code == 201
    assert registration.json()["data"]["auth"]["access_token"]
    handoff = await authorize_callback()
    login = await api.post("/api/v1/auth/github/exchange", json={"code": handoff})
    assert login.status_code == 200
    assert login.json()["data"]["user"]["email"] == "github@example.com"


async def test_wrong_browser_cannot_consume_state(api, github_config):
    start = await api.post("/api/v1/auth/github/authorize")
    state = parse_qs(urlparse(start.json()["data"]["authorization_url"]).query)["state"][0]
    cookie = api.cookies.get("jobx_github_binding")
    api.cookies.set("jobx_github_binding", "other", domain="test.local", path="/")
    response = await api.get("/api/v1/auth/github/callback", params={"state": state, "code": "x"})
    assert response.status_code == 400
    api.cookies.set("jobx_github_binding", cookie, domain="test.local", path="/")


async def test_github_callback_redirects_on_denied_error(api, github_config):
    response = await api.get(
        "/api/v1/auth/github/callback",
        params={"error": "access_denied", "error_description": "User denied access"},
        follow_redirects=False,
    )
    assert response.status_code == 303
    loc = response.headers["location"]
    assert "error=access_denied" in loc
    assert "User+denied+access" in loc or "User%20denied%20access" in loc
