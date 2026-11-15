"""Domain routes for candidate and employer workflows, AI operations, and mutual matching."""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.database import get_db
from app.configs.dependencies import get_current_user
from app.models import (
    Artifact,
    ArtifactAnalysis,
    ArtifactSkillEvidence,
    CandidateProfile,
    CompanyProfile,
    JobMatch,
    JobPost,
    JobSkillRequirement,
    Skill,
    User,
)
from app.schemas.artifact import ArtifactRead, Visibility
from app.schemas.artifact_contribution import ArtifactContributionRead
from app.schemas.candidate_profile import CandidateProfileRead
from app.schemas.company_profile import CompanyProfileRead
from app.schemas.job_match import JobMatchRead
from app.schemas.job_post import JobPostRead, JobPostUpdate
from app.services.artifact_processing_service import (
    queue_artifact_analysis,
    run_artifact_analysis,
)
from app.services.job_generation_service import (
    GenerateJobInput,
    generate_job_description,
)
from app.services.match_generation_service import (
    generate_candidate_match,
    get_job_matches_for_employer,
    submit_match_decision,
)
from app.services.owned_contribution_service import OwnedContributionInput, save_owned_contribution
from app.services.self_service_job_service import update_owned_job
from app.utils.exceptions import AppError
from app.utils.responses import item_response, list_response

router = APIRouter(tags=["domain-workflows"])


@router.post("/my/artifacts/{artifact_id}/contribution")
async def save_my_contribution(
    artifact_id: int,
    schema: OwnedContributionInput,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await save_owned_contribution(db, artifact_id, schema, user)
    return item_response(
        "Contribution saved",
        "artifact_contribution",
        ArtifactContributionRead.model_validate(record),
    )


# --- Schemas ---
class CandidateProfileInput(BaseModel):
    headline: str | None = Field(default=None, max_length=150)
    biography: str | None = Field(default=None, max_length=5000)
    city: str | None = Field(default=None, max_length=120)
    province: str | None = Field(default=None, max_length=120)
    country: str = Field(default="Indonesia", max_length=100)
    years_experience: int | None = Field(default=None, ge=0, le=100)
    preferred_employment_type: Literal[
        "full_time", "part_time", "contract", "internship", "freelance", "any"
    ] = "full_time"
    preferred_work_mode: Literal["onsite", "hybrid", "remote", "any"] = "remote"
    expected_salary_min: str | None = None
    expected_salary_max: str | None = None
    profile_visibility: Literal["public", "registered_only", "matching_employers", "private"] = (
        "matching_employers"
    )


class CompanyProfileInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=5000)
    city: str | None = Field(default=None, max_length=120)
    province: str | None = Field(default=None, max_length=120)
    country: str = Field(default="Indonesia", max_length=100)


class CreateArtifactInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    artifact_type: Literal[
        "github_repository", "document", "spreadsheet", "image", "video", "other"
    ] = "document"
    description: str | None = Field(default=None, max_length=10000)
    source_url: str | None = Field(default=None, max_length=1000)
    visibility: Visibility = "matching_employers"


class UpdateArtifactInput(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    visibility: Visibility | None = None


class JobPostInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    business_problem: str = Field(min_length=1)
    job_summary: str | None = None
    job_description: str | None = None
    employment_type: Literal["full_time", "part_time", "contract", "internship", "freelance"] = (
        "full_time"
    )
    work_mode: Literal["onsite", "hybrid", "remote"] = "remote"
    city: str | None = None
    province: str | None = None
    country: str = "Indonesia"
    salary_min: str | None = None
    salary_max: str | None = None
    currency: str = "IDR"
    status: Literal["draft", "published", "paused", "closed"] = "draft"
    requirements: list[dict] = Field(default_factory=list)


class EvidenceReviewInput(BaseModel):
    review_status: Literal["candidate_confirmed", "rejected"]


class MatchDecisionInput(BaseModel):
    decision: Literal["pending", "accepted", "rejected"]


# --- Candidate Profile Endpoints ---
@router.get("/candidate-profile/me")
@router.get("/my/candidate-profile")
async def get_my_candidate_profile(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    profile = await db.get(CandidateProfile, user.id)
    if profile is None:
        return item_response("No profile created yet", "candidate_profile", None)
    return item_response(
        "Candidate profile retrieved",
        "candidate_profile",
        CandidateProfileRead.model_validate(profile),
    )


@router.patch("/candidate-profile/me")
@router.post("/candidate-profile/me")
@router.patch("/my/candidate-profile")
@router.post("/my/candidate-profile")
async def save_my_candidate_profile(
    schema: CandidateProfileInput,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.account_type != "candidate":
        raise AppError(403, "Access denied", {"auth": "Candidate account required"})

    profile = await db.get(CandidateProfile, user.id)
    if profile is None:
        profile = CandidateProfile(user_id=user.id)
        db.add(profile)

    for field, value in schema.model_dump(exclude_unset=True).items():
        if field in {"expected_salary_min", "expected_salary_max"}:
            setattr(
                profile, field, int(value) if value is not None and str(value).isdigit() else None
            )
        else:
            setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return item_response(
        "Candidate profile saved", "candidate_profile", CandidateProfileRead.model_validate(profile)
    )


# --- Company Profile Endpoints ---
@router.get("/company-profile/me")
@router.get("/my/company-profile")
async def get_my_company_profile(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    profile = await db.scalar(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
    if profile is None:
        return item_response("No company profile created yet", "company_profile", None)
    return item_response(
        "Company profile retrieved", "company_profile", CompanyProfileRead.model_validate(profile)
    )


@router.patch("/company-profile/me")
@router.post("/company-profile/me")
@router.patch("/my/company-profile")
@router.post("/my/company-profile")
async def save_my_company_profile(
    schema: CompanyProfileInput,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.account_type != "employer":
        raise AppError(403, "Access denied", {"auth": "Employer account required"})

    profile = await db.scalar(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
    if profile is None:
        profile = CompanyProfile(user_id=user.id, name=schema.name)
        db.add(profile)

    for field, value in schema.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return item_response(
        "Company profile saved", "company_profile", CompanyProfileRead.model_validate(profile)
    )


# --- Candidate Artifacts Endpoints ---
@router.get("/my/artifacts")
async def list_my_artifacts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Artifact)
        .where(Artifact.owner_user_id == user.id)
        .order_by(Artifact.id.desc())
        .limit(limit)
        .offset(offset)
    )
    records = list(await db.scalars(query))
    total = (
        await db.scalar(
            select(func.count()).select_from(Artifact).where(Artifact.owner_user_id == user.id)
        )
        or 0
    )
    return list_response(
        "Artifacts retrieved",
        "artifacts",
        [ArtifactRead.model_validate(r) for r in records],
        total,
        limit,
        offset,
    )


@router.post("/my/artifacts", status_code=201)
async def create_my_artifact(
    schema: CreateArtifactInput,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.account_type != "candidate":
        raise AppError(403, "Access denied", {"auth": "Candidate access required"})

    artifact = Artifact(
        owner_user_id=user.id,
        title=schema.title,
        artifact_type=schema.artifact_type,
        description=schema.description,
        source_url=schema.source_url,
        visibility=schema.visibility,
        processing_status="not_started",
    )
    db.add(artifact)
    await db.commit()
    await db.refresh(artifact)
    return item_response("Artifact created", "artifact", ArtifactRead.model_validate(artifact))


@router.patch("/my/artifacts/{artifact_id}")
async def update_my_artifact(
    artifact_id: int,
    schema: UpdateArtifactInput,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    artifact = await db.get(Artifact, artifact_id)
    if artifact is None or artifact.owner_user_id != user.id:
        raise AppError(404, "Artifact not found", {"artifact": "Record does not exist"})

    for field, val in schema.model_dump(exclude_unset=True).items():
        setattr(artifact, field, val)

    await db.commit()
    await db.refresh(artifact)
    return item_response("Artifact updated", "artifact", ArtifactRead.model_validate(artifact))


@router.delete("/my/artifacts/{artifact_id}")
async def delete_my_artifact(
    artifact_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    artifact = await db.get(Artifact, artifact_id)
    if artifact is None or artifact.owner_user_id != user.id:
        raise AppError(404, "Artifact not found", {"artifact": "Record does not exist"})

    await db.delete(artifact)
    await db.commit()
    if artifact.storage_key and artifact.storage_key.startswith("local/"):
        import asyncio

        from app.services.artifact_upload_service import managed_path

        await asyncio.to_thread(managed_path(artifact.storage_key).unlink, missing_ok=True)
    return item_response("Artifact deleted", "artifact", {"id": str(artifact_id)})


@router.post("/artifacts/{artifact_id}/analyze", status_code=201)
async def trigger_artifact_analysis(
    artifact_id: int,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis = await queue_artifact_analysis(db, artifact_id, user)
    # Automatically execute analysis in the background
    background_tasks.add_task(run_artifact_analysis, analysis.id)
    return item_response(
        "Analysis queued",
        "artifact_analysis",
        {
            "id": str(analysis.id),
            "artifact_id": str(analysis.artifact_id),
            "analysis_status": analysis.analysis_status,
        },
    )


@router.get("/artifacts/{artifact_id}/analysis")
async def get_artifact_analysis_status(
    artifact_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    artifact = await db.get(Artifact, artifact_id)
    if artifact is None:
        raise AppError(404, "Artifact not found", {"artifact": "Record does not exist"})
    if user.account_type != "admin" and artifact.owner_user_id != user.id:
        raise AppError(403, "Access denied", {"auth": "You do not own this artifact"})

    latest = await db.scalar(
        select(ArtifactAnalysis)
        .where(ArtifactAnalysis.artifact_id == artifact_id)
        .order_by(ArtifactAnalysis.id.desc())
        .limit(1)
    )
    if latest is None:
        return item_response("No analysis performed yet", "artifact_analysis", None)

    return item_response(
        "Analysis retrieved",
        "artifact_analysis",
        {
            "id": str(latest.id),
            "artifact_id": str(latest.artifact_id),
            "analysis_status": latest.analysis_status,
            "extracted_summary": latest.extracted_summary,
            "error_message": latest.error_message,
            "created_at": latest.created_at.isoformat() if latest.created_at else None,
        },
    )


# --- Skill Evidences Endpoints ---
@router.get("/artifact-skill-evidences/my")
@router.get("/my/skill-evidences")
async def list_my_skill_evidences(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    evidences = list(
        await db.scalars(
            select(ArtifactSkillEvidence)
            .join(Artifact, Artifact.id == ArtifactSkillEvidence.artifact_id)
            .where(Artifact.owner_user_id == user.id)
            .order_by(ArtifactSkillEvidence.id.desc())
            .limit(100)
        )
    )
    items = []
    for ev in evidences:
        skill = await db.get(Skill, ev.skill_id)
        items.append(
            {
                "id": str(ev.id),
                "artifact_id": str(ev.artifact_id),
                "skill_id": str(ev.skill_id),
                "skill_name": skill.canonical_name if skill else f"Skill #{ev.skill_id}",
                "evidence_kind": ev.evidence_kind,
                "evidence_excerpt": ev.evidence_excerpt,
                "evidence_location": ev.evidence_location,
                "confidence_score": str(ev.confidence_score),
                "review_status": ev.review_status,
            }
        )
    return {
        "message": {"success": "Evidences retrieved"},
        "error": {},
        "data": {"artifact_skill_evidences": items},
    }


@router.patch("/artifact-skill-evidences/{evidence_id}/review")
async def review_skill_evidence(
    evidence_id: int,
    schema: EvidenceReviewInput,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    evidence = await db.get(ArtifactSkillEvidence, evidence_id)
    if evidence is None:
        raise AppError(404, "Evidence not found", {"evidence": "Record does not exist"})

    artifact = await db.get(Artifact, evidence.artifact_id)
    if artifact is None or (user.account_type != "admin" and artifact.owner_user_id != user.id):
        raise AppError(403, "Access denied", {"auth": "You do not own this artifact evidence"})

    if evidence.review_status == "reviewer_verified" and user.account_type != "admin":
        raise AppError(
            409, "Evidence already verified", {"review_status": "Admin verification is protected"}
        )

    evidence.review_status = schema.review_status
    await db.commit()
    await db.refresh(evidence)
    return item_response(
        "Evidence review updated",
        "artifact_skill_evidence",
        {
            "id": str(evidence.id),
            "review_status": evidence.review_status,
        },
    )


# --- Job Posts Endpoints ---
@router.get("/jobs/published")
async def list_published_jobs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(JobPost)
        .where(JobPost.status == "published")
        .order_by(JobPost.id.desc())
        .limit(limit)
        .offset(offset)
    )
    records = list(await db.scalars(query))
    total = (
        await db.scalar(
            select(func.count()).select_from(JobPost).where(JobPost.status == "published")
        )
        or 0
    )
    return list_response(
        "Published jobs retrieved",
        "job_posts",
        [JobPostRead.model_validate(r) for r in records],
        total,
        limit,
        offset,
    )


@router.get("/job-posts/my")
@router.get("/my/job-posts")
async def list_my_job_posts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.account_type not in {"employer", "admin"}:
        raise AppError(403, "Access denied", {"auth": "Employer access required"})

    query = (
        select(JobPost)
        .where(JobPost.user_id == user.id)
        .order_by(JobPost.id.desc())
        .limit(limit)
        .offset(offset)
    )
    records = list(await db.scalars(query))
    total = (
        await db.scalar(select(func.count()).select_from(JobPost).where(JobPost.user_id == user.id))
        or 0
    )
    return list_response(
        "Job posts retrieved",
        "job_posts",
        [JobPostRead.model_validate(r) for r in records],
        total,
        limit,
        offset,
    )


@router.post("/job-posts/my", status_code=201)
@router.post("/my/job-posts", status_code=201)
async def create_my_job_post(
    schema: JobPostInput, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if user.account_type not in {"employer", "admin"}:
        raise AppError(403, "Access denied", {"auth": "Employer access required"})
    if schema.status == "published":
        raise AppError(
            409,
            "Publication approval required",
            {"status": "Save a draft; publication approval workflow is not configured"},
        )

    job = JobPost(
        user_id=user.id,
        title=schema.title,
        business_problem=schema.business_problem,
        job_summary=schema.job_summary,
        job_description=schema.job_description,
        employment_type=schema.employment_type,
        work_mode=schema.work_mode,
        city=schema.city,
        province=schema.province,
        country=schema.country,
        salary_min=int(schema.salary_min)
        if schema.salary_min and schema.salary_min.isdigit()
        else None,
        salary_max=int(schema.salary_max)
        if schema.salary_max and schema.salary_max.isdigit()
        else None,
        currency=schema.currency,
        status=schema.status,
        published_at=datetime.now(UTC).replace(tzinfo=None)
        if schema.status == "published"
        else None,
    )
    db.add(job)
    await db.flush()

    for req in schema.requirements:
        skill_id = req.get("skill_id")
        if skill_id:
            skill = await db.get(Skill, int(skill_id))
            if skill is None:
                raise AppError(
                    422,
                    "Invalid skill",
                    {"requirements": f"Skill {skill_id} does not exist in catalog"},
                )
            db.add(
                JobSkillRequirement(
                    job_id=job.id,
                    skill_id=int(skill_id),
                    requirement_type=req.get("requirement_type", "must_have"),
                    weight=float(req.get("weight", 1.0)),
                )
            )

    await db.commit()
    await db.refresh(job)
    return item_response("Job created", "job_post", JobPostRead.model_validate(job))


@router.patch("/job-posts/my/{job_id}")
@router.patch("/my/job-posts/{job_id}")
async def update_my_job_post(
    job_id: int,
    schema: JobPostUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await update_owned_job(db, job_id, schema, user)
    return item_response("Job updated", "job_post", JobPostRead.model_validate(job))


@router.post("/jobs/generate-description")
async def generate_job_draft(
    schema: GenerateJobInput,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await generate_job_description(db, schema, user)
    return item_response("Draft generated", "job_draft", result)


@router.get("/catalog/skills")
async def list_skill_catalog(db: AsyncSession = Depends(get_db)):
    skills = list(await db.scalars(select(Skill).order_by(Skill.canonical_name).limit(100)))
    return {
        "message": {"success": "Catalog retrieved"},
        "error": {},
        "data": {
            "skills": [
                {
                    "id": str(s.id),
                    "canonical_name": s.canonical_name,
                    "category": s.category,
                    "description": s.description,
                }
                for s in skills
            ]
        },
    }


# --- Matching & Mutual Decision Endpoints ---
@router.post("/job-posts/{job_id}/match")
async def match_candidate_to_job(
    job_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    match = await generate_candidate_match(db, job_id, user)
    return item_response("Match calculated", "job_match", JobMatchRead.model_validate(match))


@router.get("/job-posts/{job_id}/matches")
async def list_job_matches_for_employer(
    job_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    results = await get_job_matches_for_employer(db, job_id, user)
    return {"message": {"success": "Matches retrieved"}, "error": {}, "data": {"matches": results}}


@router.get("/job-matches/my")
@router.get("/my/job-matches")
async def list_my_job_matches(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    matches = list(
        await db.scalars(
            select(JobMatch)
            .where(JobMatch.candidate_user_id == user.id)
            .order_by(JobMatch.id.desc())
        )
    )
    items = []
    for m in matches:
        job = await db.get(JobPost, m.job_id)
        company = (
            await db.scalar(select(CompanyProfile).where(CompanyProfile.user_id == job.user_id))
            if job
            else None
        )
        items.append(
            {
                "id": str(m.id),
                "job_id": str(m.job_id),
                "job_title": job.title if job else f"Job #{m.job_id}",
                "company_name": company.name if company else "Employer",
                "candidate_user_id": str(m.candidate_user_id),
                "match_score": str(m.match_score),
                "score_breakdown": m.score_breakdown,
                "explanation": m.explanation,
                "candidate_decision": m.candidate_decision,
                "employer_decision": m.employer_decision,
                "match_status": m.match_status,
                "calculated_at": m.calculated_at.isoformat() if m.calculated_at else None,
            }
        )
    return {
        "message": {"success": "Matches retrieved"},
        "error": {},
        "data": {"job_matches": items},
    }


@router.post("/job-matches/{match_id}/decision")
async def make_match_decision(
    match_id: int,
    schema: MatchDecisionInput,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    match = await submit_match_decision(db, match_id, user, schema.decision)
    return item_response("Decision recorded", "job_match", JobMatchRead.model_validate(match))
