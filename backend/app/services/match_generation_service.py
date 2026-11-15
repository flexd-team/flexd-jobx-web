"""Service for calculating matches and recording two-way employer/candidate decisions."""

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import or_, select

from app.agents.matching.graph import build_matching_graph
from app.agents.matching.schemas import MatchInput
from app.models import (
    Artifact,
    ArtifactAnalysis,
    ArtifactSkillEvidence,
    CandidateProfile,
    JobMatch,
    JobPost,
    JobSkillRequirement,
    Skill,
    User,
)
from app.utils.exceptions import AppError


async def generate_candidate_match(db, job_id: int, candidate: User) -> JobMatch:
    if candidate.account_type != "candidate":
        raise AppError(403, "Access denied", {"auth": "Candidate access required"})

    job = await db.scalar(
        select(JobPost)
        .where(JobPost.id == job_id, JobPost.status == "published")
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if job is None:
        raise AppError(404, "Job post not found", {"job_post": "Published job post does not exist"})
    if (job.ai_generation_metadata or {}).get("demo"):
        raise AppError(409, "Demo job", {"job_post": "Synthetic jobs cannot generate real matches"})

    now = datetime.now(UTC).replace(tzinfo=None)
    if job.closes_at is not None and job.closes_at <= now:
        raise AppError(409, "Job closed", {"job_post": "Job is closed for applications"})

    profile = await db.get(CandidateProfile, candidate.id)

    # 1. Gather job skill requirements
    req_rows = list(
        (
            await db.execute(
                select(JobSkillRequirement, Skill)
                .join(Skill, Skill.id == JobSkillRequirement.skill_id)
                .where(JobSkillRequirement.job_id == job_id)
                .order_by(JobSkillRequirement.id)
            )
        ).all()
    )

    if not req_rows:
        # Default requirement if employer hasn't specified skills
        skills = list(await db.scalars(select(Skill).limit(3)))
        requirements = (
            [
                {
                    "skill_id": str(s.id),
                    "skill_name": s.canonical_name,
                    "requirement_type": "must_have",
                    "weight": Decimal("1.0"),
                }
                for s in skills
            ]
            if skills
            else [
                {
                    "skill_id": "1",
                    "skill_name": "General Competence",
                    "requirement_type": "must_have",
                    "weight": Decimal("1.0"),
                }
            ]
        )
    else:
        requirements = [
            {
                "skill_id": str(r.skill_id),
                "skill_name": s.canonical_name,
                "requirement_type": r.requirement_type,
                "weight": Decimal(str(r.weight)),
            }
            for r, s in req_rows
        ]

    # 2. Gather candidate evidence from artifacts
    evidence_rows = list(
        await db.scalars(
            select(ArtifactSkillEvidence)
            .join(Artifact, Artifact.id == ArtifactSkillEvidence.artifact_id)
            .outerjoin(ArtifactAnalysis, ArtifactAnalysis.id == ArtifactSkillEvidence.analysis_id)
            .where(
                Artifact.owner_user_id == candidate.id,
                ArtifactSkillEvidence.review_status != "rejected",
                or_(
                    ArtifactAnalysis.id.is_(None),
                    ArtifactAnalysis.model_provider.is_(None),
                    ArtifactAnalysis.model_provider != "demo",
                ),
            )
            .order_by(ArtifactSkillEvidence.id)
        )
    )

    evidence = [
        {
            "skill_id": str(e.skill_id),
            "evidence_kind": e.evidence_kind,
            "review_status": e.review_status,
            "evidence_location": e.evidence_location or "artifact",
        }
        for e in evidence_rows
    ]

    # 3. Preference compatibility
    preferences = {}
    if profile:
        if profile.preferred_employment_type and profile.preferred_employment_type != "any":
            preferences["employment_type"] = Decimal(
                100 if profile.preferred_employment_type == job.employment_type else 0
            )
        if profile.preferred_work_mode and profile.preferred_work_mode != "any":
            preferences["work_mode"] = Decimal(
                100 if profile.preferred_work_mode == job.work_mode else 0
            )
        if profile.city and job.city and job.work_mode != "remote":
            preferences["location"] = Decimal(
                100 if profile.city.strip().casefold() == job.city.strip().casefold() else 0
            )

    snapshot = MatchInput(
        approval_status="approved",
        publication_status="published",
        requirements=requirements,
        evidence=evidence,
        preference_factors=preferences,
    )

    match_result = (await build_matching_graph().ainvoke({"input": snapshot}))["result"]

    record = await db.scalar(
        select(JobMatch)
        .where(JobMatch.job_id == job_id, JobMatch.candidate_user_id == candidate.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if record is None:
        record = JobMatch(job_id=job_id, candidate_user_id=candidate.id)
        db.add(record)

    record.match_score = match_result.match_score
    record.score_breakdown = match_result.model_dump(
        mode="json",
        include={"formula_version", "score_breakdown", "effective_weights", "limitations"},
    )
    record.explanation = match_result.explanation
    record.calculated_at = now

    await db.flush()
    await db.refresh(record)
    await db.commit()
    return record


async def get_job_matches_for_employer(db, job_id: int, employer: User) -> list[dict]:
    job = await db.get(JobPost, job_id)
    if job is None:
        raise AppError(404, "Job not found", {"job_post": "Job does not exist"})
    if employer.account_type != "admin" and job.user_id != employer.id:
        raise AppError(403, "Access denied", {"auth": "You do not own this job post"})

    matches = list(
        await db.scalars(
            select(JobMatch).where(JobMatch.job_id == job_id).order_by(JobMatch.match_score.desc())
        )
    )

    results = []
    for m in matches:
        candidate_user = await db.get(User, m.candidate_user_id)
        candidate_profile = await db.get(CandidateProfile, m.candidate_user_id)
        candidate_evidence = list(
            await db.scalars(
                select(ArtifactSkillEvidence)
                .join(Artifact, Artifact.id == ArtifactSkillEvidence.artifact_id)
                .where(
                    Artifact.owner_user_id == m.candidate_user_id,
                    Artifact.visibility.in_(["matching_employers", "public"]),
                    ArtifactSkillEvidence.review_status != "rejected",
                )
                .limit(10)
            )
        )
        results.append(
            {
                "match": {
                    "id": str(m.id),
                    "job_id": str(m.job_id),
                    "candidate_user_id": str(m.candidate_user_id),
                    "match_score": str(m.match_score),
                    "score_breakdown": m.score_breakdown,
                    "explanation": m.explanation,
                    "candidate_decision": m.candidate_decision,
                    "employer_decision": m.employer_decision,
                    "match_status": m.match_status,
                    "calculated_at": m.calculated_at.isoformat() if m.calculated_at else None,
                },
                "candidate": {
                    "id": str(candidate_user.id) if candidate_user else "",
                    "name": candidate_user.name if candidate_user else "Kandidat",
                    "email": candidate_user.email
                    if (m.match_status == "mutually_accepted" and candidate_user)
                    else None,
                    "headline": candidate_profile.headline if candidate_profile else None,
                    "city": candidate_profile.city if candidate_profile else None,
                    "years_experience": candidate_profile.years_experience
                    if candidate_profile
                    else None,
                },
                "evidence": [
                    {
                        "id": str(ev.id),
                        "skill_id": str(ev.skill_id),
                        "evidence_excerpt": ev.evidence_excerpt,
                        "evidence_location": ev.evidence_location,
                        "confidence_score": str(ev.confidence_score),
                        "review_status": ev.review_status,
                    }
                    for ev in candidate_evidence
                ],
            }
        )

    return results


async def submit_match_decision(db, match_id: int, actor: User, decision: str) -> JobMatch:
    if decision not in {"pending", "accepted", "rejected"}:
        raise AppError(
            422, "Invalid decision", {"decision": "Must be pending, accepted, or rejected"}
        )

    match = await db.scalar(select(JobMatch).where(JobMatch.id == match_id).with_for_update())
    if match is None:
        raise AppError(404, "Match not found", {"job_match": "Record does not exist"})

    job = await db.get(JobPost, match.job_id)
    now = datetime.now(UTC).replace(tzinfo=None)

    if actor.id == match.candidate_user_id:
        match.candidate_decision = decision
        match.candidate_decided_at = now
    elif job and actor.id == job.user_id:
        match.employer_decision = decision
        match.employer_decided_at = now
    elif actor.account_type == "admin":
        match.candidate_decision = decision
        match.employer_decision = decision
    else:
        raise AppError(403, "Access denied", {"auth": "You are not a participant in this match"})

    await db.commit()
    await db.refresh(match)
    return match
