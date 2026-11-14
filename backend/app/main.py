from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.configs.database import get_session_factory
from app.configs.logging import configure_logging
from app.configs.settings import get_settings
from app.middlewares.error_handlers import register_error_handlers
from app.middlewares.request_context import RequestContextMiddleware
from app.routes import (
    artifact_analysis_route,
    artifact_contribution_route,
    artifact_route,
    artifact_skill_evidence_route,
    auth_route,
    candidate_profile_route,
    company_profile_route,
    domain_routes,
    github_auth_route,
    github_repository_route,
    job_match_route,
    job_post_route,
    job_skill_requirement_route,
    skill_alias_route,
    skill_route,
    user_route,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    if get_session_factory.cache_info().currsize:
        await get_session_factory().kw["bind"].dispose()
        get_session_factory.cache_clear()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.app_log_level)
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if settings.app_env == "production" else "/docs",
    )
    app.add_middleware(RequestContextMiddleware)
    register_error_handlers(app)
    for router in (
        auth_route.router,
        github_auth_route.router,
        github_repository_route.router,
        user_route.router,
        candidate_profile_route.router,
        company_profile_route.router,
        artifact_route.router,
        artifact_analysis_route.router,
        artifact_contribution_route.router,
        artifact_skill_evidence_route.router,
        skill_route.router,
        skill_alias_route.router,
        job_post_route.router,
        job_skill_requirement_route.router,
        job_match_route.router,
        domain_routes.router,
    ):
        app.include_router(router, prefix=settings.app_api_prefix)
    return app


# CORS wraps even unhandled-error responses. OpenAPI/docs use FastAPI's native format.
application = create_app()
app = CORSMiddleware(
    application,
    allow_origins=get_settings().app_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Request-ID"],
)
