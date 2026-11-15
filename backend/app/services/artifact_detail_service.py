from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Artifact,
    ArtifactAnalysis,
    ArtifactContribution,
    ArtifactSkillEvidence,
    Skill,
    User,
)
from app.schemas.artifact import ArtifactRead
from app.schemas.artifact_contribution import ArtifactContributionRead
from app.utils.exceptions import AppError


async def get_owned_artifact(db: AsyncSession, artifact_id: int, actor: User):
    if actor.account_type != "candidate":
        raise AppError(403, "Access denied", {"auth": "Candidate account required"})
    record = await db.scalar(
        select(Artifact).where(Artifact.id == artifact_id, Artifact.owner_user_id == actor.id)
    )
    if record is None:
        raise AppError(404, "Artifact not found", {"artifact": "Record does not exist"})
    return record


async def get_artifact_detail(db: AsyncSession, artifact_id: int, actor: User):
    record = await get_owned_artifact(db, artifact_id, actor)
    contribution = await db.scalar(
        select(ArtifactContribution).where(
            ArtifactContribution.artifact_id == artifact_id,
            ArtifactContribution.contributor_user_id == actor.id,
        )
    )
    analysis = await db.scalar(
        select(ArtifactAnalysis)
        .where(ArtifactAnalysis.artifact_id == artifact_id)
        .order_by(ArtifactAnalysis.id.desc())
        .limit(1)
    )
    return {
        "artifact": ArtifactRead.model_validate(record),
        "artifact_contribution": ArtifactContributionRead.model_validate(contribution)
        if contribution
        else None,
        "artifact_analysis": {
            "id": str(analysis.id),
            "analysis_status": analysis.analysis_status,
            "extracted_summary": analysis.extracted_summary,
            "error_message": analysis.error_message,
        }
        if analysis
        else None,
    }


async def list_artifact_evidence(
    db: AsyncSession, artifact_id: int, actor: User, limit: int, offset: int
):
    await get_owned_artifact(db, artifact_id, actor)
    rows = await db.execute(
        select(ArtifactSkillEvidence, Skill.canonical_name)
        .join(Skill, Skill.id == ArtifactSkillEvidence.skill_id)
        .where(ArtifactSkillEvidence.artifact_id == artifact_id)
        .order_by(ArtifactSkillEvidence.id)
        .limit(limit)
        .offset(offset)
    )
    items = [
        {
            "id": str(ev.id),
            "artifact_id": str(ev.artifact_id),
            "analysis_id": str(ev.analysis_id) if ev.analysis_id is not None else None,
            "skill_id": str(ev.skill_id),
            "skill_name": name,
            "evidence_kind": ev.evidence_kind,
            "evidence_excerpt": ev.evidence_excerpt,
            "evidence_location": ev.evidence_location,
            "confidence_score": str(ev.confidence_score),
            "review_status": ev.review_status,
        }
        for ev, name in rows
    ]
    total = await db.scalar(
        select(func.count())
        .select_from(ArtifactSkillEvidence)
        .where(ArtifactSkillEvidence.artifact_id == artifact_id)
    )
    return items, total
