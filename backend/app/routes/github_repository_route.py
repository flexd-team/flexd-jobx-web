from fastapi import APIRouter, Depends, Query
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.database import get_db
from app.configs.dependencies import get_current_user
from app.models import User
from app.schemas.artifact import ArtifactRead, Visibility
from app.schemas.common import Input
from app.services import github_repository_service as service
from app.utils.responses import item_response

router = APIRouter(tags=["github-repositories"])


class ImportRepository(Input):
    repository_id: str = Field(pattern=r"^[1-9][0-9]{0,19}$")
    repository_name: str = Field(pattern=r"^[A-Za-z0-9_.-]{1,100}$")
    title: str = Field(min_length=1, max_length=200, pattern=r"\S")
    description: str | None = Field(default=None, max_length=10000)
    visibility: Visibility = "matching_employers"
    role_title: str = Field(min_length=1, max_length=150, pattern=r"\S")
    contribution_description: str = Field(min_length=1, max_length=10000, pattern=r"\S")


@router.get("/integrations/github/repositories")
async def repositories(
    page: int = Query(1, ge=1, le=10000),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    values = await service.list_repositories(db, user, page, per_page)
    return {
        "message": {"success": "Repositories retrieved"},
        "error": {},
        "data": {"repositories": values, "pagination": {"page": page, "per_page": per_page}},
    }


@router.post("/artifacts/github/import", status_code=201)
async def import_repository(
    schema: ImportRepository,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    artifact = await service.import_repository(db, user, schema)
    return item_response("Artifact imported", "artifact", ArtifactRead.model_validate(artifact))
