from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Artifact, ArtifactContribution, User
from app.schemas.common import Input
from app.utils.exceptions import AppError


class OwnedContributionInput(Input):
    role_title: str
    contribution_description: str


async def save_owned_contribution(
    db: AsyncSession, artifact_id: int, schema: OwnedContributionInput, actor: User
):
    try:
        if actor.account_type != "candidate":
            raise AppError(403, "Access denied", {"auth": "Candidate account required"})
        artifact = await db.scalar(
            select(Artifact).where(Artifact.id == artifact_id).with_for_update()
        )
        if artifact is None or artifact.owner_user_id != actor.id:
            raise AppError(404, "Artifact not found", {"artifact": "Record does not exist"})
        if not schema.role_title.strip() or len(schema.role_title) > 150:
            raise AppError(422, "Validation failed", {"role_title": "Use 1–150 characters"})
        if (
            not schema.contribution_description.strip()
            or len(schema.contribution_description) > 10000
        ):
            raise AppError(
                422, "Validation failed", {"contribution_description": "Use 1–10000 characters"}
            )
        record = await db.scalar(
            select(ArtifactContribution).where(
                ArtifactContribution.artifact_id == artifact_id,
                ArtifactContribution.contributor_user_id == actor.id,
            )
        )
        if record is None:
            record = ArtifactContribution(
                artifact_id=artifact_id, contributor_user_id=actor.id, claim_status="self_declared"
            )
            db.add(record)
        if record.claim_status != "self_declared":
            raise AppError(
                409, "Contribution confirmed", {"claim_status": "Confirmed claims are protected"}
            )
        record.role_title = schema.role_title.strip()
        record.contribution_description = schema.contribution_description.strip()
        await db.flush()
        await db.refresh(record)
        await db.commit()
        return record
    except Exception:
        await db.rollback()
        raise
