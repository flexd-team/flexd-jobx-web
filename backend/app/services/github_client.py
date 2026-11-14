"""Minimal async GitHub OAuth client; no token persistence or request logging."""

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from pydantic import EmailStr, TypeAdapter, ValidationError

from app.configs.settings import Settings
from app.services.github_oauth_state import pkce_challenge


class GitHubError(Exception):
    """Safe provider failure; never include provider response or credentials."""


@dataclass(frozen=True)
class GitHubIdentity:
    provider_user_id: str
    name: str
    email: str | None


class GitHubClient:
    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self.settings = settings
        self.client = client

    def authorization_url(self, state: str, verifier: str) -> str:
        if not self.settings.app_github_client_id or not state:
            raise GitHubError("GitHub OAuth is not configured")
        query = urlencode(
            {
                "client_id": self.settings.app_github_client_id,
                "redirect_uri": self.settings.app_github_callback_url,
                "scope": "user:email",
                "state": state,
                "code_challenge": pkce_challenge(verifier),
                "code_challenge_method": "S256",
            }
        )
        return f"https://github.com/login/oauth/authorize?{query}"

    async def exchange_identity(self, code: str, verifier: str) -> GitHubIdentity:
        settings = self.settings
        if (
            not settings.app_github_client_id
            or not settings.app_github_client_secret.get_secret_value()
        ):
            raise GitHubError("GitHub OAuth is not configured")
        try:
            response = await self.client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": settings.app_github_client_id,
                    "client_secret": settings.app_github_client_secret.get_secret_value(),
                    "code": code,
                    "redirect_uri": settings.app_github_callback_url,
                    "code_verifier": verifier,
                },
                headers={"Accept": "application/json"},
                follow_redirects=False,
                timeout=10,
            )
            response.raise_for_status()
            token = response.json().get("access_token")
            if not isinstance(token, str) or not token:
                raise GitHubError("GitHub authorization failed")
            headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}"}
            user_response = await self.client.get(
                "https://api.github.com/user", headers=headers, follow_redirects=False, timeout=10
            )
            user_response.raise_for_status()
            email_response = await self.client.get(
                "https://api.github.com/user/emails",
                headers=headers,
                params={"per_page": 100},
                follow_redirects=False,
                timeout=10,
            )
            email_response.raise_for_status()
            user, emails = user_response.json(), email_response.json()
            if not isinstance(user, dict) or not isinstance(emails, list):
                raise GitHubError("Invalid GitHub identity response")
            user_id, login = user.get("id"), user.get("login")
            if type(user_id) is not int or user_id <= 0 or not isinstance(login, str) or not login:
                raise GitHubError("Invalid GitHub identity response")
            verified = [e for e in emails if isinstance(e, dict) and e.get("verified") is True]
            verified.sort(key=lambda e: e.get("primary") is not True)
            email = None
            for item in verified:
                try:
                    email = str(TypeAdapter(EmailStr).validate_python(item.get("email"))).lower()
                    break
                except ValidationError:
                    continue
            name = user.get("name")
            if not isinstance(name, str) or not name.strip():
                name = login
            return GitHubIdentity(str(user_id), name.strip()[:150], email)
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise GitHubError("GitHub request failed") from exc
