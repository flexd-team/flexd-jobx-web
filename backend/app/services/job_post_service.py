from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import JobPost
from app.schemas.job_post import JobPostCreate, JobPostUpdate
from app.services.validation import reject_nulls, require_account_type, validate_range
from app.utils.database_errors import translate_database_error
from app.utils.exceptions import AppError


def validate_job(values: dict):
    validate_range(values, "salary_min", "salary_max")


async def list_job_posts(db: AsyncSession, limit: int, offset: int):
    records = await db.scalars(select(JobPost).order_by(JobPost.id).limit(limit).offset(offset))
    return list(records), await db.scalar(select(func.count()).select_from(JobPost))


async def get_job_post(db: AsyncSession, record_id: int):
    record = await db.get(JobPost, record_id)
    if record is None:
        raise AppError(404, "Job post not found", {"job_post": "Record does not exist"})
    return record


async def create_job_post(db: AsyncSession, schema: JobPostCreate):
    try:
        await require_account_type(db, schema.user_id, "user_id", "employer")
        values = schema.model_dump()
        validate_job(values)
        record = JobPost(**values)
        db.add(record)
        await db.flush()
        await db.refresh(record)
        await db.commit()
        return record
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "job_post") from exc
    except Exception:
        await db.rollback()
        raise


async def update_job_post(db: AsyncSession, record_id: int, schema: JobPostUpdate):
    try:
        record = await db.scalar(
            select(JobPost)
            .where(JobPost.id == record_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if record is None:
            raise AppError(404, "Job post not found", {"job_post": "Record does not exist"})
        values = schema.model_dump(exclude_unset=True)
        reject_nulls(
            values,
            "title",
            "business_problem",
            "employment_type",
            "work_mode",
            "country",
            "currency",
            "status",
        )
        validate_job(
            {
                "salary_min": record.salary_min,
                "salary_max": record.salary_max,
                **values,
            }
        )
        for field, value in values.items():
            setattr(record, field, value)
        await db.flush()
        await db.refresh(record)
        await db.commit()
        return record
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "job_post") from exc
    except Exception:
        await db.rollback()
        raise


async def delete_job_post(db: AsyncSession, record_id: int):
    try:
        record = await db.scalar(select(JobPost).where(JobPost.id == record_id).with_for_update())
        if record is None:
            raise AppError(404, "Job post not found", {"job_post": "Record does not exist"})
        await db.delete(record)
        await db.commit()
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "job_post") from exc
    except Exception:
        await db.rollback()
        raise
