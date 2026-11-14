from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app.configs.settings import Settings
from app.services.github_client import GitHubClient, GitHubError


def settings():
    return Settings(
        _env_file=None, app_github_client_id="client", app_github_client_secret="secret"
    )


async def test_authorize_and_exchange_without_persisting_token():
    requests = []

    def respond(request):
        requests.append(request)
        if request.url.host == "github.com":
            return httpx.Response(200, json={"access_token": "test-provider-token"})
        if request.url.path == "/user":
            return httpx.Response(200, json={"id": 123, "login": "candidate", "name": "Name"})
        return httpx.Response(
            200,
            json=[
                {"email": "other@example.com", "verified": True, "primary": False},
                {"email": "primary@example.com", "verified": True, "primary": True},
            ],
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        client = GitHubClient(settings(), http)
        verifier = "a" * 64
        query = parse_qs(urlparse(client.authorization_url("state", verifier)).query)
        assert query["scope"] == ["user:email"]
        assert query["code_challenge_method"] == ["S256"]
        assert verifier not in client.authorization_url("state", verifier)
        identity = await client.exchange_identity("code", verifier)
        assert identity.provider_user_id == "123"
        assert identity.email == "primary@example.com"
        assert "test-provider-token" not in repr(identity)
        assert len(requests) == 3


async def test_unverified_email_not_used():
    def respond(request):
        if request.url.host == "github.com":
            return httpx.Response(200, json={"access_token": "test-token"})
        if request.url.path == "/user":
            return httpx.Response(200, json={"id": 1, "login": "candidate"})
        return httpx.Response(200, json=[{"email": "x@example.com", "verified": False}])

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        assert (
            await GitHubClient(settings(), http).exchange_identity("code", "a" * 64)
        ).email is None


async def test_provider_failure_is_safe():
    def respond(request):
        return httpx.Response(401, text="sensitive provider response")

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        with pytest.raises(GitHubError, match="GitHub request failed") as error:
            await GitHubClient(settings(), http).exchange_identity("code", "a" * 64)
        assert "sensitive" not in str(error.value)
