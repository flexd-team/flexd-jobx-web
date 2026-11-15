from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.database import get_db
from app.configs.dependencies import get_current_user
from app.controllers import artifact_upload_controller as controller
from app.models import User
from app.schemas.common import UnsignedId

router = APIRouter(tags=["artifact-files"])


@router.post("/my/artifacts/upload", status_code=201)
async def upload(
    request: Request,
    title: str = Query(min_length=1, max_length=200),
    artifact_type: Literal["document", "spreadsheet", "image", "video"] = "document",
    visibility: Literal["private", "unlisted", "matching_employers", "public"] = "private",
    filename: str = Query(min_length=1, max_length=200),
    description: str = Query(default="", max_length=10000),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return await controller.upload(
        db, actor, request, title, artifact_type, visibility, filename, description
    )


@router.get("/my/artifacts/{artifact_id}/file")
async def download(
    artifact_id: UnsignedId,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return await controller.download(db, artifact_id, actor)
