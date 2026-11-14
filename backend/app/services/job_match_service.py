from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import JobMatch, JobPost
from app.schemas.job_match import JobMatchCreate, JobMatchUpdate
from app.services.validation import reject_nulls, require_account_type, require_reference
from app.utils.database_errors import translate_database_error
from app.utils.exceptions import AppError


def validate_decisions(candidate: str, employer: str, status: str):
    if status == "expired":
        return
    expected = "recommended"
    if "rejected" in (candidate, employer):
        expected = "rejected"
    elif candidate == employer == "accepted":
        expected = "mutually_accepted"
    elif "accepted" in (candidate, employer):
        expected = "one_side_interested"
    if status != expected:
        raise AppError(
            422, "Validation failed", {"match_status": f"Decisions require status {expected}"}
        )


async def list_job_matches(db: AsyncSession, limit: int, offset: int):
    records = await db.scalars(select(JobMatch).order_by(JobMatch.id).limit(limit).offset(offset))
    return list(records), await db.scalar(select(func.count()).select_from(JobMatch))


async def get_job_match(db: AsyncSession, record_id: int):
    record = await db.get(JobMatch, record_id)
    if record is None:
        raise AppError(404, "Job match not found", {"job_match": "Record does not exist"})
    return record


async def create_job_match(db: AsyncSession, schema: JobMatchCreate):
    try:
        await require_reference(db, JobPost, schema.job_id, "job_id")
        await require_account_type(db, schema.candidate_user_id, "candidate_user_id", "candidate")
        validate_decisions(schema.candidate_decision, schema.employer_decision, schema.match_status)
        values = schema.model_dump()
        values.pop("match_status", None)
        record = JobMatch(**values)
        db.add(record)
        await db.flush()
        await db.refresh(record)
        await db.commit()
        return record
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "job_match") from exc
    except Exception:
        await db.rollback()
        raise


async def update_job_match(db: AsyncSession, record_id: int, schema: JobMatchUpdate):
    try:
        record = await db.scalar(
            select(JobMatch)
            .where(JobMatch.id == record_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if record is None:
            raise AppError(404, "Job match not found", {"job_match": "Record does not exist"})
        values = schema.model_dump(exclude_unset=True)
        reject_nulls(
            values,
            "match_score",
            "score_breakdown",
            "explanation",
            "candidate_decision",
            "employer_decision",
            "match_status",
        )
        validate_decisions(
            values.get("candidate_decision", record.candidate_decision),
            values.get("employer_decision", record.employer_decision),
            values.get("match_status", record.match_status),
        )
        values.pop("match_status", None)
        for field, value in values.items():
            setattr(record, field, value)
        await db.flush()
        await db.refresh(record)
        await db.commit()
        return record
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "job_match") from exc
    except Exception:
        await db.rollback()
        raise


async def delete_job_match(db: AsyncSession, record_id: int):
    try:
        record = await db.scalar(select(JobMatch).where(JobMatch.id == record_id).with_for_update())
        if record is None:
            raise AppError(404, "Job match not found", {"job_match": "Record does not exist"})
        await db.delete(record)
        await db.commit()
    except DBAPIError as exc:
        await db.rollback()
        raise translate_database_error(exc, "job_match") from exc
    except Exception:
        await db.rollback()
        raise
