"""Owner-scoped job edits. Client cannot mutate ownership or internal metadata."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import JobPost, User
from app.schemas.job_post import JobPostUpdate
from app.services.job_post_service import update_job_post
from app.utils.exceptions import AppError


async def update_owned_job(db: AsyncSession, job_id: int, schema: JobPostUpdate, actor: User):
    try:
        if actor.account_type != "employer":
            raise AppError(403, "Access denied", {"auth": "Employer account required"})
        job = await db.scalar(select(JobPost).where(JobPost.id == job_id).with_for_update())
        if job is None or job.user_id != actor.id:
            raise AppError(404, "Job not found", {"job_post": "Record does not exist"})
        values = schema.model_dump(exclude_unset=True)
        if {"ai_generation_metadata", "published_at"} & values.keys():
            raise AppError(422, "Validation failed", {"job_post": "Internal fields are immutable"})
        if values.get("status") == "published" and job.status != "published":
            raise AppError(
                409,
                "Publication approval required",
                {"status": "Publication approval workflow is not configured"},
            )
        if job.status == "closed" and values.get("status", "closed") != "closed":
            raise AppError(409, "Job is closed", {"status": "Closed jobs cannot be reopened"})
        return await update_job_post(db, job_id, schema)
    except Exception:
        await db.rollback()
        raise
