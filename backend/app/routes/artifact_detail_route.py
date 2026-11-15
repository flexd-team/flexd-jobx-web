from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.database import get_db
from app.configs.dependencies import get_current_user
from app.controllers.artifact_detail_controller import (
    get_owned_artifact_detail,
    get_owned_artifact_evidence,
)
from app.models import User
from app.schemas.common import UnsignedId

router = APIRouter(tags=["artifact-details"])


@router.get("/my/artifacts/{artifact_id}")
async def detail(
    artifact_id: UnsignedId,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return await get_owned_artifact_detail(db, artifact_id, actor)


@router.get("/my/artifacts/{artifact_id}/skill-evidences")
async def evidence(
    artifact_id: UnsignedId,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return await get_owned_artifact_evidence(db, artifact_id, actor, limit, offset)
