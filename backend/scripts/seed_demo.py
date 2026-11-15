"""Explicit, additive demo seed. Run from backend with python -m scripts.seed_demo."""

import argparse
import asyncio
from datetime import UTC, datetime
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
    Skill,
    SkillAlias,
    User,
)
from scripts.seed_scenarios import SCENARIOS
from scripts.seed_skills import SKILLS_DATA

SEED_VERSION = "jobx-demo-v1"


async def seed_demo(db, candidate_id=3, employer_id=4):
    """Flush only; caller owns commit/rollback. Never modifies existing rows."""
    users = list(
        await db.scalars(
            select(User).where(User.id.in_([candidate_id, employer_id])).with_for_update()
        )
    )
    by_id = {user.id: user for user in users}
    for user_id, role in [(candidate_id, "candidate"), (employer_id, "employer")]:
        user = by_id.get(user_id)
        if user is None or user.account_type != role or user.account_status != "active":
            raise ValueError(f"User {user_id} must exist as active {role}; no accounts changed")

    counts = {}

    async def ensure(model, conditions, values):
        row = await db.scalar(select(model).where(*conditions))
        if row is None:
            row = model(**values)
            db.add(row)
            await db.flush()
            counts[model.__tablename__] = counts.get(model.__tablename__, 0) + 1
        return row

    await ensure(
        CandidateProfile,
        [CandidateProfile.user_id == candidate_id],
        {
            "user_id": candidate_id,
            "headline": "Full-stack Developer | Python, React, TypeScript",
            "biography": "Pengembang aplikasi web yang berfokus pada API operasional dan "
            "dashboard bisnis. Terbiasa merancang kontrak API, validasi data, serta "
            "pengujian integrasi dalam tim produk kecil.",
            "city": "Bandung",
            "years_experience": Decimal("2.0"),
            "preferred_employment_type": "full_time",
            "preferred_work_mode": "remote",
            "expected_salary_min": 8000000,
            "expected_salary_max": 12000000,
        },
    )
    await ensure(
        CompanyProfile,
        [CompanyProfile.user_id == employer_id],
        {
            "user_id": employer_id,
            "name": "Ruang Karya Digital",
            "industry": "Software",
            "description": "Studio pengembangan perangkat lunak untuk operasional ritel "
            "dan layanan pelanggan. Tim lintas fungsi membangun aplikasi web, integrasi "
            "API, serta pelaporan bisnis dengan proses review kode dan pengujian rutin.",
            "city": "Bandung",
        },
    )

    catalog = {}
    for item in SKILLS_DATA:
        skill = await ensure(
            Skill,
            [Skill.slug == item["slug"]],
            {
                "canonical_name": item["canonical_name"],
                "slug": item["slug"],
                "category": item["category"],
                "description": item["description"],
                "taxonomy_source": "jobx_default_catalog",
            },
        )
        catalog[item["slug"]] = skill
        for alias in item["aliases"]:
            normalized = alias.strip().lower()
            existing = await db.scalar(
                select(SkillAlias).where(SkillAlias.normalized_alias == normalized)
            )
            if existing is not None and existing.skill_id != skill.id:
                raise ValueError(
                    "Existing skill alias conflicts with demo catalog; seed rolled back"
                )
            await ensure(
                SkillAlias,
                [SkillAlias.normalized_alias == normalized],
                {
                    "skill_id": skill.id,
                    "alias_name": alias.strip(),
                    "normalized_alias": normalized,
                },
            )

    now = datetime.now(UTC).replace(tzinfo=None)
    for scenario in SCENARIOS:
        key, title, slug = (scenario[name] for name in ("key", "title", "slug"))
        candidate_decision = scenario["candidate_decision"]
        employer_decision = scenario["employer_decision"]
        url = f"https://example.invalid/{SEED_VERSION}/{candidate_id}/{employer_id}/{key}"
        artifact = await ensure(
            Artifact,
            [
                Artifact.owner_user_id == candidate_id,
                Artifact.source_url == url,
            ],
            {
                "owner_user_id": candidate_id,
                "title": title,
                "artifact_type": "document",
                "source_url": url,
                "description": scenario["description"],
                "visibility": "matching_employers",
                "processing_status": "needs_review",
                "metadata_json": {"demo": True, "seed_version": SEED_VERSION},
            },
        )
        # URL is a reserved placeholder, not a real uploaded document.
        if (artifact.metadata_json or {}).get("seed_version") != SEED_VERSION:
            raise ValueError("Artifact seed identity conflicts with existing data")
        await ensure(
            ArtifactContribution,
            [
                ArtifactContribution.artifact_id == artifact.id,
                ArtifactContribution.contributor_user_id == candidate_id,
            ],
            {
                "artifact_id": artifact.id,
                "contributor_user_id": candidate_id,
                "role_title": scenario["role"],
                "contribution_description": scenario["contribution"],
                "claim_status": "self_declared",
                "contribution_share_percent": Decimal(scenario["share"]),
            },
        )
        analysis = await ensure(
            ArtifactAnalysis,
            [
                ArtifactAnalysis.artifact_id == artifact.id,
                ArtifactAnalysis.prompt_version == SEED_VERSION,
            ],
            {
                "artifact_id": artifact.id,
                "analysis_status": "needs_human_review",
                "model_provider": "demo",
                "model_name": "synthetic-seed-v1",
                "prompt_version": SEED_VERSION,
                "extracted_summary": scenario["description"],
                "raw_result": {
                    "demo": True,
                    "synthetic": True,
                    "limitations": ["Seed fixture; bukan hasil pemeriksaan model."],
                },
            },
        )
        skill = catalog[slug]
        await ensure(
            ArtifactSkillEvidence,
            [
                ArtifactSkillEvidence.analysis_id == analysis.id,
                ArtifactSkillEvidence.skill_id == skill.id,
            ],
            {
                "artifact_id": artifact.id,
                "analysis_id": analysis.id,
                "skill_id": skill.id,
                "evidence_kind": "inferred",
                "confidence_score": Decimal(scenario["confidence"]),
                "evidence_excerpt": scenario["contribution"],
                "evidence_location": "portfolio:contribution",
                "review_status": "ai_suggested",
            },
        )
        job = await ensure(
            JobPost,
            [
                JobPost.user_id == employer_id,
                JobPost.title == scenario["job_title"],
            ],
            {
                "user_id": employer_id,
                "title": scenario["job_title"],
                "business_problem": scenario["problem"],
                "job_summary": scenario["problem"],
                "job_description": scenario["problem"]
                + "\n\nTanggung jawab: "
                + scenario["contribution"]
                + "\n\nKualifikasi: "
                + scenario["requirements"],
                "employment_type": "full_time",
                "work_mode": scenario["work_mode"],
                "city": "Bandung",
                "salary_min": scenario["salary_min"],
                "salary_max": scenario["salary_max"],
                "status": "draft",
                "ai_generation_metadata": {"demo": True, "seed_version": SEED_VERSION},
            },
        )
        if (job.ai_generation_metadata or {}).get("seed_version") != SEED_VERSION:
            raise ValueError("Job seed identity conflicts with existing data")
        await ensure(
            JobSkillRequirement,
            [
                JobSkillRequirement.job_id == job.id,
                JobSkillRequirement.skill_id == skill.id,
            ],
            {
                "job_id": job.id,
                "skill_id": skill.id,
                "requirement_type": "must_have",
                "weight": Decimal("1.00"),
                "minimum_level": "intermediate",
                "requirement_note": scenario["requirements"],
            },
        )
        await ensure(
            JobMatch,
            [JobMatch.job_id == job.id, JobMatch.candidate_user_id == candidate_id],
            {
                "job_id": job.id,
                "candidate_user_id": candidate_id,
                "match_score": Decimal(scenario["score"]),
                "score_breakdown": {
                    "demo": True,
                    "synthetic": True,
                    "limitations": ["Seed fixture; bukan skor matching terhitung."],
                },
                "explanation": f"Portfolio {title} relevan dengan kebutuhan "
                f"{catalog[slug].canonical_name}. Kontribusi mencakup "
                "pengembangan fitur dan pengujian; kedalaman pengalaman perlu dikonfirmasi "
                "melalui review portfolio dan wawancara teknis.",
                "candidate_decision": candidate_decision,
                "employer_decision": employer_decision,
                "candidate_decided_at": now if candidate_decision != "pending" else None,
                "employer_decided_at": now if employer_decision != "pending" else None,
            },
        )
    return counts


async def run(args):
    settings = get_settings()
    if settings.app_env == "production":
        raise ValueError("Demo seed is disabled in production")
    if args.apply and args.confirm != "SEED_DEMO_3_4":
        raise ValueError("Writes require --apply --confirm SEED_DEMO_3_4")
    factory = get_session_factory()
    try:
        async with factory() as db:
            try:
                counts = await seed_demo(db)
                if args.apply:
                    await db.commit()
                else:
                    await db.rollback()
                print(
                    {"mode": "applied" if args.apply else "dry-run (rolled back)", "added": counts}
                )
            except Exception:
                await db.rollback()
                raise
    finally:
        await factory.kw["bind"].dispose()
        get_session_factory.cache_clear()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm", default="")
    args = parser.parse_args()
    try:
        asyncio.run(run(args))
    except Exception:
        parser.exit(
            1, "Demo seed failed; transaction rolled back. Check roles, schema and DB access.\n"
        )


if __name__ == "__main__":
    main()
