"""Development OAuth flow: in-memory state, one process only."""

import secrets
from typing import Literal
from urllib.parse import urlencode, urlsplit

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.database import get_db
from app.configs.dependencies import get_current_user
from app.configs.settings import get_settings
from app.models import User, UserOAuthIdentity
from app.schemas.common import Input
from app.schemas.user import UserRead
from app.services.github_client import GitHubClient, GitHubError, GitHubIdentity
from app.services.github_identity_service import (
    find_github_user,
    link_github_user,
    register_github_user,
    unlink_github_user,
)
from app.services.github_oauth_state import OAuthStateStore, OneTimeHandoffStore
from app.utils.exceptions import AppError
from app.utils.rate_limit import limit_login, limit_register
from app.utils.security import create_access_token

router = APIRouter(tags=["github-auth"])
states = OAuthStateStore()
handoffs = OneTimeHandoffStore()
COOKIE = "jobx_github_binding"


class ExchangeInput(Input):
    code: str = Field(min_length=1, max_length=256)


class RegisterInput(ExchangeInput):
    account_type: Literal["candidate", "employer"]


def ok(message: str, data: dict):
    return {"message": {"success": message}, "error": {}, "data": data}


def binding(request: Request) -> str:
    value = request.cookies.get(COOKIE, "")
    if not value or not value.isascii() or len(value) > 256:
        raise AppError(400, "Authentication failed", {"auth": "OAuth session unavailable"})
    return value


def config_guard():
    settings = get_settings()
    if settings.app_env == "production":
        raise AppError(503, "Service unavailable", {"auth": "OAuth requires a shared state store"})
    if (
        not settings.app_github_client_id
        or not settings.app_github_client_secret.get_secret_value()
    ):
        raise AppError(503, "Service unavailable", {"auth": "GitHub OAuth is not configured"})
    frontend = urlsplit(settings.app_github_frontend_callback_url)
    if frontend.scheme not in ("http", "https") or not frontend.netloc or frontend.fragment:
        raise AppError(503, "Service unavailable", {"auth": "Invalid OAuth callback configuration"})
    return settings


async def start(request: Request, response: Response, purpose: str, user_id: int | None = None):
    settings = config_guard()
    browser = secrets.token_urlsafe(32)

    frontend_callback = settings.app_github_frontend_callback_url
    origin = request.headers.get("origin", "").rstrip("/")
    if origin:
        parsed = urlsplit(origin)
        if parsed.scheme in ("http", "https") and parsed.netloc:
            if (
                origin in settings.app_cors_origins
                or settings.app_env != "production"
                and parsed.hostname in ("localhost", "127.0.0.1")
            ):
                callback_path = (
                    urlsplit(settings.app_github_frontend_callback_url).path
                    or "/auth/github/callback"
                )
                frontend_callback = f"{origin}{callback_path}"

    state, transaction = states.create(purpose, browser, user_id, frontend_callback)
    async with httpx.AsyncClient() as http:
        url = GitHubClient(settings, http).authorization_url(state, transaction.code_verifier)
    response.set_cookie(
        COOKIE,
        browser,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        max_age=600,
        path="/",
    )
    return ok("GitHub authorization prepared", {"authorization_url": url})


@router.post("/auth/github/authorize", dependencies=[Depends(limit_login)])
async def authorize(request: Request, response: Response):
    return await start(request, response, "login")


@router.post("/integrations/github/authorize", dependencies=[Depends(limit_login)])
async def authorize_link(
    request: Request, response: Response, user: User = Depends(get_current_user)
):
    return await start(request, response, "link", user.id)


@router.get("/auth/github/callback")
async def callback(request: Request, db: AsyncSession = Depends(get_db)):
    settings = config_guard()
    oauth_error = request.query_params.get("error", "")
    if oauth_error:
        error_desc = request.query_params.get("error_description", "")
        params = {"error": oauth_error}
        if error_desc:
            params["error_description"] = error_desc[:200]
        frontend_url = settings.app_github_frontend_callback_url
        state = request.query_params.get("state", "")
        if state:
            try:
                txn = states.consume(state, binding(request))
                if txn and txn.frontend_callback_url:
                    frontend_url = txn.frontend_callback_url
            except Exception:
                pass
        separator = "&" if urlsplit(frontend_url).query else "?"
        target = frontend_url + separator + urlencode(params)
        return RedirectResponse(target, status_code=303, headers={"Referrer-Policy": "no-referrer"})

    state = request.query_params.get("state", "")
    code = request.query_params.get("code", "")
    transaction = states.consume(state, binding(request))
    if transaction is None or not code or len(code) > 2048:
        raise AppError(400, "Authentication failed", {"auth": "Invalid or expired OAuth session"})
    try:
        async with httpx.AsyncClient() as http:
            identity = await GitHubClient(settings, http).exchange_identity(
                code, transaction.code_verifier
            )
    except GitHubError as exc:
        raise AppError(
            502, "Authentication failed", {"auth": "GitHub authorization failed"}
        ) from exc
    if transaction.purpose == "link":
        await link_github_user(db, transaction.user_id, identity)
        payload = ("linked", None)
    else:
        user = await find_github_user(db, identity)
        payload = ("login", user.id) if user else ("register", identity)
    handoff = handoffs.create(binding(request), payload)
    frontend_url = (
        transaction.frontend_callback_url
        if transaction and transaction.frontend_callback_url
        else settings.app_github_frontend_callback_url
    )
    separator = "&" if urlsplit(frontend_url).query else "?"
    target = frontend_url + separator + urlencode({"code": handoff})
    return RedirectResponse(target, status_code=303, headers={"Referrer-Policy": "no-referrer"})


@router.post("/auth/github/exchange", dependencies=[Depends(limit_login)])
async def exchange(schema: ExchangeInput, request: Request, db: AsyncSession = Depends(get_db)):
    result = handoffs.consume(schema.code, binding(request))
    if result is None:
        raise AppError(400, "Authentication failed", {"auth": "Invalid or expired exchange code"})
    kind, value = result
    if kind == "register":
        if not value.email:
            raise AppError(422, "Validation failed", {"email": "Verified GitHub email required"})
        code = handoffs.create(binding(request), ("register", value))
        return ok("Registration required", {"registration_code": code})
    if kind == "linked":
        return ok("GitHub linked", {"linked": True})
    user = await db.get(User, value)
    if user is None or user.account_status != "active":
        raise AppError(401, "Authentication failed", {"auth": "Account is unavailable"})
    return login_response(user)


def login_response(user: User):
    return ok(
        "Login successful",
        {
            "user": UserRead.model_validate(user).model_dump(mode="json"),
            "auth": {"access_token": create_access_token(user.id), "token_type": "bearer"},
        },
    )


@router.post("/auth/github/register", status_code=201, dependencies=[Depends(limit_register)])
async def register(schema: RegisterInput, request: Request, db: AsyncSession = Depends(get_db)):
    result = handoffs.consume(schema.code, binding(request))
    if not result or result[0] != "register" or not isinstance(result[1], GitHubIdentity):
        raise AppError(
            400, "Authentication failed", {"auth": "Invalid or expired registration code"}
        )
    user = await register_github_user(db, result[1], schema.account_type)
    return login_response(user)


@router.get("/integrations/github/connection")
async def connection(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    identity = await db.scalar(
        select(UserOAuthIdentity).where(
            UserOAuthIdentity.user_id == user.id, UserOAuthIdentity.provider == "github"
        )
    )
    return ok("GitHub connection retrieved", {"connected": identity is not None})


@router.delete("/integrations/github/connection")
async def unlink(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await unlink_github_user(db, user.id)
    return ok("GitHub disconnected", {})
