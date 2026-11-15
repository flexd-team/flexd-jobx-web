"""Refresh only recognized v1 seed fixtures; preserve non-seed user content."""

import argparse
import asyncio
from decimal import Decimal

from sqlalchemy import select

from app.configs.database import get_session_factory
from app.configs.settings import get_settings
from app.models import (
    Artifact,
    ArtifactAnalysis,
    ArtifactContribution,
    ArtifactSkillEvidence,
    CandidateProfile,
    CompanyProfile,
    JobMatch,
    JobPost,
    JobSkillRequirement,
    User,
)
from scripts.seed_demo import SEED_VERSION
from scripts.seed_scenarios import SCENARIOS


async def refresh(db):
    for user_id, role in [(3, "candidate"), (4, "employer")]:
        user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
        if user is None or user.account_type != role or user.account_status != "active":
            raise ValueError("Seed account roles/status do not match")
    artifacts = list(
        await db.scalars(
            select(Artifact)
            .where(
                Artifact.owner_user_id == 3,
            )
            .with_for_update()
        )
    )
    jobs = list(await db.scalars(select(JobPost).where(JobPost.user_id == 4).with_for_update()))
    old_titles = ["Backend API", "Frontend Dashboard", "Full-stack Portal", "API Testing"]
    changed = []
    for scenario, old_title in zip(SCENARIOS, old_titles, strict=True):
        url = f"https://example.invalid/{SEED_VERSION}/3/4/{scenario['key']}"
        matching_artifacts = [
            a
            for a in artifacts
            if a.source_url == url and (a.metadata_json or {}).get("seed_version") == SEED_VERSION
        ]
        matching_jobs = [
            j
            for j in jobs
            if (j.ai_generation_metadata or {}).get("seed_version") == SEED_VERSION
            and j.title in {old_title, f"[DEMO] {old_title}", scenario["job_title"]}
        ]
        if len(matching_artifacts) != 1 or len(matching_jobs) != 1:
            raise ValueError("Seed identities missing or ambiguous; no changes committed")
        artifact, job = matching_artifacts[0], matching_jobs[0]
        artifact.title = scenario["title"]
        artifact.description = scenario["description"]
        contributions = list(
            await db.scalars(
                select(ArtifactContribution).where(
                    ArtifactContribution.artifact_id == artifact.id,
                    ArtifactContribution.contributor_user_id == 3,
                )
            )
        )
        for contribution in contributions:
            contribution.role_title = scenario["role"]
            contribution.contribution_description = scenario["contribution"]
            contribution.contribution_share_percent = Decimal(scenario["share"])
        analyses = list(
            await db.scalars(
                select(ArtifactAnalysis).where(
                    ArtifactAnalysis.artifact_id == artifact.id,
                    ArtifactAnalysis.prompt_version == SEED_VERSION,
                    ArtifactAnalysis.model_provider == "demo",
                )
            )
        )
        for analysis in analyses:
            analysis.extracted_summary = scenario["description"]
            analysis.raw_result = {
                **(analysis.raw_result or {}),
                "demo": True,
                "synthetic": True,
                "limitations": ["Seed fixture; bukan hasil pemeriksaan model."],
            }
            evidence = list(
                await db.scalars(
                    select(ArtifactSkillEvidence).where(
                        ArtifactSkillEvidence.analysis_id == analysis.id,
                        ArtifactSkillEvidence.review_status == "ai_suggested",
                    )
                )
            )
            for item in evidence:
                item.evidence_excerpt = scenario["contribution"]
                item.evidence_location = "portfolio:contribution"
                item.confidence_score = Decimal(scenario["confidence"])
        job.title = scenario["job_title"]
        job.business_problem = scenario["problem"]
        job.job_summary = scenario["problem"]
        job.job_description = (
            scenario["problem"]
            + "\n\nTanggung jawab: "
            + scenario["contribution"]
            + "\n\nKualifikasi: "
            + scenario["requirements"]
        )
        job.salary_min, job.salary_max = scenario["salary_min"], scenario["salary_max"]
        job.work_mode = scenario["work_mode"]
        for requirement in await db.scalars(
            select(JobSkillRequirement).where(
                JobSkillRequirement.job_id == job.id,
            )
        ):
            requirement.requirement_note = scenario["requirements"]
        for match in await db.scalars(
            select(JobMatch).where(
                JobMatch.job_id == job.id,
                JobMatch.candidate_user_id == 3,
            )
        ):
            if (match.score_breakdown or {}).get("demo"):
                match.match_score = Decimal(scenario["score"])
                match.explanation = (
                    f"Portfolio {scenario['title']} relevan dengan kebutuhan posisi. "
                    "Kontribusi mencakup pengembangan fitur dan pengujian; kedalaman pengalaman "
                    "perlu dikonfirmasi melalui review portfolio dan wawancara teknis."
                )
                match.score_breakdown = {
                    **match.score_breakdown,
                    "synthetic": True,
                    "limitations": ["Seed fixture; bukan skor matching terhitung."],
                }
        changed.append({"artifact_id": artifact.id, "job_id": job.id})
    profile = await db.get(CandidateProfile, 3)
    if profile and "[DEMO]" in (profile.headline or ""):
        profile.headline = "Full-stack Developer | Python, React, TypeScript"
        profile.biography = (
            "Pengembang aplikasi web berfokus pada API operasional dan dashboard bisnis. "
            "Berpengalaman merancang kontrak API, validasi data, dan pengujian integrasi."
        )
    company = await db.scalar(select(CompanyProfile).where(CompanyProfile.user_id == 4))
    if company and "[DEMO]" in company.name:
        company.name = "Ruang Karya Digital"
        company.description = (
            "Studio perangkat lunak untuk operasional ritel dan layanan pelanggan. "
            "Membangun aplikasi web, integrasi API, serta pelaporan bisnis dengan review kode "
            "dan pengujian rutin."
        )
    await db.flush()
    return changed


async def run(apply):
    if get_settings().app_env == "production":
        raise ValueError("Seed refresh disabled in production")
    factory = get_session_factory()
    try:
        async with factory() as db:
            try:
                changed = await refresh(db)
                if apply:
                    await db.commit()
                else:
                    await db.rollback()
                print({"mode": "applied" if apply else "dry-run", "updated": changed})
            except Exception:
                await db.rollback()
                raise
    finally:
        await factory.kw["bind"].dispose()
        get_session_factory.cache_clear()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        asyncio.run(run(args.apply))
    except Exception:
        parser.exit(1, "Seed refresh failed; transaction rolled back. Check seed identities.\n")
