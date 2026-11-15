from decimal import Decimal
from types import SimpleNamespace

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.agents.artifact_analysis.schemas import ArtifactDraft
from app.agents.shared.contracts import ArtifactContent, SourceBlock
from app.agents.shared.structured_output import LangChainStructuredModel
from app.configs.database import get_db
from app.configs.settings import Settings, get_settings
from app.main import application
from app.models import (
    Artifact,
    ArtifactAnalysis,
    ArtifactSkillEvidence,
    CandidateProfile,
    JobMatch,
    JobPost,
    User,
)
from app.services import artifact_processing_service as processing
from app.services.artifact_ingestion.dispatcher import ArtifactIngestor
from app.services.demo_data import DEMO_LABEL
from app.services.job_generation_service import GenerateJobInput, generate_job_description
from app.services.match_generation_service import generate_candidate_match
from app.utils.exceptions import AppError
from scripts.seed_demo import seed_demo


def test_demo_environment_guard(monkeypatch):
    monkeypatch.setenv("APP_DEMO", "true")
    assert Settings(_env_file=None, app_env="test").app_demo is True
    with pytest.raises(ValidationError, match="APP_DEMO"):
        Settings(_env_file=None, app_env="production")


class FailingChat:
    def with_structured_output(self, *args, **kwargs):
        return self

    async def ainvoke(self, messages):
        raise RuntimeError("synthetic provider failure")


async def test_successful_model_output_unchanged_in_demo():
    class Chat(FailingChat):
        async def ainvoke(self, messages):
            return {"summary": "Real model output", "evidence": []}

    adapter = LangChainStructuredModel(Chat(), demo_fallback=True)
    result = await adapter.generate(ArtifactDraft, "Analyze", {})
    assert result.summary == "Real model output"
    assert not adapter.demo_used


async def test_invalid_model_output_gets_explicit_demo():
    class Chat(FailingChat):
        async def ainvoke(self, messages):
            return {"unknown": "invalid result"}

    adapter = LangChainStructuredModel(Chat(), demo_fallback=True)
    result = await adapter.generate(ArtifactDraft, "Analyze", {})
    assert result.summary == DEMO_LABEL
    assert adapter.demo_used


async def test_demo_adapter_only_on_model_failure():
    adapter = LangChainStructuredModel(FailingChat(), demo_fallback=True)
    result = await adapter.generate(ArtifactDraft, "Analyze", {})
    assert adapter.demo_used
    assert result.summary == DEMO_LABEL
    assert result.evidence == []
    with pytest.raises(RuntimeError):
        await LangChainStructuredModel(FailingChat()).generate(ArtifactDraft, "Analyze", {})


async def test_demo_never_hides_media_integrity_failure():
    async def loader(source):
        return b"changed"

    adapter = LangChainStructuredModel(FailingChat(), media_loader=loader, demo_fallback=True)
    with pytest.raises(ValueError, match="integrity"):
        await adapter.generate(
            ArtifactDraft,
            "Analyze",
            {
                "content": {
                    "media_sources": [
                        {"byte_size": 1, "sha256": "0" * 64},
                    ]
                }
            },
        )
    assert not adapter.demo_used


async def test_job_demo_fallback_and_role_guard(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "app_demo", True)
    # Fixture clears LLM credentials; no network or paid calls.
    stream = application.dependency_overrides[get_db]()
    db = await anext(stream)
    try:
        result = await generate_job_description(
            db,
            GenerateJobInput(business_problem="Build demo"),
            SimpleNamespace(account_type="employer"),
        )
        assert result["demo"] is True
        assert result["draft"]["requirements"] == []
        assert DEMO_LABEL in result["limitations"]
        with pytest.raises(AppError):
            await generate_job_description(
                db,
                GenerateJobInput(business_problem="Build demo"),
                SimpleNamespace(account_type="candidate"),
            )
        monkeypatch.setattr(get_settings(), "app_demo", False)
        with pytest.raises(AppError):
            await generate_job_description(
                db,
                GenerateJobInput(business_problem="Build demo"),
                SimpleNamespace(account_type="employer"),
            )
    finally:
        await stream.aclose()


async def demo_users(db):
    user = await db.get(User, 3)
    user.account_type = "candidate"
    db.add(
        User(
            id=4,
            name="Demo Employer",
            email="demo4@example.com",
            account_type="employer",
            account_status="active",
        )
    )
    db.add(CandidateProfile(user_id=3, headline="Keep existing headline"))
    await db.commit()


async def test_seed_idempotent_preserves_existing_and_dry_run(api):
    stream = application.dependency_overrides[get_db]()
    db = await anext(stream)
    try:
        await demo_users(db)
        counts = await seed_demo(db)
        assert counts["artifact"] == 4
        assert counts["job_match"] == 4
        await db.rollback()
        assert await db.scalar(select(func.count()).select_from(Artifact)) == 0
        await seed_demo(db)
        await db.commit()
        assert await seed_demo(db) == {}
        assert (await db.get(CandidateProfile, 3)).headline == "Keep existing headline"
        assert await db.scalar(select(func.count()).select_from(ArtifactSkillEvidence)) == 4
        assert set(await db.scalars(select(JobPost.status))) == {"draft"}
        assert set(await db.scalars(select(JobMatch.match_score))) == {
            Decimal("82.50"),
            Decimal("89.25"),
            Decimal("86.75"),
            Decimal("74.00"),
        }
        assert all("DEMO" not in title for title in await db.scalars(select(Artifact.title)))
        assert all("DEMO" not in text for text in await db.scalars(select(JobPost.job_description)))
    finally:
        await stream.aclose()


async def test_seed_role_mismatch_adds_nothing(api):
    stream = application.dependency_overrides[get_db]()
    db = await anext(stream)
    try:
        with pytest.raises(ValueError, match="active candidate"):
            await seed_demo(db)
        await db.rollback()
        assert await db.scalar(select(func.count()).select_from(Artifact)) == 0
    finally:
        await stream.aclose()


async def test_refresh_seed_content_preserves_accounts_and_nonseed_content(api):
    from scripts.refresh_seed_content import refresh

    stream = application.dependency_overrides[get_db]()
    db = await anext(stream)
    try:
        await demo_users(db)
        await seed_demo(db)
        artifact = await db.scalar(select(Artifact).order_by(Artifact.id))
        artifact.title = "Backend API"
        extra = Artifact(
            owner_user_id=3,
            title="Keep my work",
            artifact_type="document",
            source_url="https://example.invalid/user-work",
        )
        db.add(extra)
        await db.commit()
        assert len(await refresh(db)) == 4
        await db.commit()
        assert artifact.title == "Sistem Inventori dan Pemesanan Gudang"
        assert extra.title == "Keep my work"
        assert (await db.get(CandidateProfile, 3)).headline == "Keep existing headline"
        assert (await db.get(User, 3)).account_type == "candidate"
        assert len(await refresh(db)) == 4
    finally:
        await stream.aclose()


async def test_seed_conflict_rolls_back_partial_inserts(api):
    stream = application.dependency_overrides[get_db]()
    db = await anext(stream)
    try:
        await demo_users(db)
        # Colliding title is user work, not an invitation to overwrite it.
        db.add(
            JobPost(
                user_id=4,
                title="Backend Developer — Inventory Platform",
                business_problem="Keep me",
                employment_type="full_time",
                work_mode="remote",
            )
        )
        await db.commit()
        with pytest.raises(ValueError, match="conflicts"):
            await seed_demo(db)
        await db.rollback()
        assert await db.scalar(select(func.count()).select_from(Artifact)) == 0
        assert await db.scalar(select(JobPost.business_problem)) == "Keep me"
    finally:
        await stream.aclose()


async def test_artifact_demo_persistence_and_reader_error_not_hidden(api, monkeypatch):
    stream = application.dependency_overrides[get_db]()
    db = await anext(stream)
    monkeypatch.setattr(get_settings(), "app_demo", True)

    class Reader:
        fail = False

        async def read(self, reference):
            if self.fail:
                raise ValueError("File integrity mismatch")
            return ArtifactContent(
                source_revision="test",
                source_locations=[
                    SourceBlock(block_id="1", location="line:1", text="Example source"),
                ],
            )

    reader = Reader()
    monkeypatch.setattr(
        processing,
        "get_session_factory",
        lambda: async_sessionmaker(
            db.bind,
            expire_on_commit=False,
        ),
    )
    monkeypatch.setattr(
        processing,
        "create_artifact_ingestor",
        lambda artifact: ArtifactIngestor(
            {
                "document": reader,
            }
        ),
    )
    try:
        artifact = Artifact(
            owner_user_id=2,
            title="Test",
            artifact_type="document",
            source_url="https://example.invalid/test",
        )
        db.add(artifact)
        await db.flush()
        artifact_id = artifact.id
        analysis = await processing.queue_artifact_analysis(db, artifact_id, await db.get(User, 2))
        analysis_id = analysis.id
        await processing.run_artifact_analysis(analysis_id)
        await db.refresh(analysis)
        assert analysis.analysis_status == "needs_human_review"
        assert analysis.model_provider == "demo"
        assert analysis.raw_result["demo"] is True
        assert DEMO_LABEL in analysis.extracted_summary
        assert await db.scalar(select(func.count()).select_from(ArtifactSkillEvidence)) == 0
        reader.fail = True
        next_analysis = await processing.queue_artifact_analysis(
            db,
            artifact_id,
            await db.get(User, 2),
        )
        await processing.run_artifact_analysis(next_analysis.id)
        await db.refresh(next_analysis)
        assert next_analysis.analysis_status == "failed"
        assert next_analysis.raw_result is None
    finally:
        await stream.aclose()


async def test_synthetic_seed_evidence_never_increases_real_match(api):
    stream = application.dependency_overrides[get_db]()
    db = await anext(stream)
    try:
        await demo_users(db)
        await seed_demo(db)
        await db.commit()
        synthetic_job = await db.scalar(select(JobPost).order_by(JobPost.id))
        candidate = await db.get(User, 3)
        synthetic_job.status = "published"
        await db.commit()
        with pytest.raises(AppError, match="Demo job"):
            await generate_candidate_match(db, synthetic_job.id, candidate)
        evidence = await db.scalar(select(ArtifactSkillEvidence))
        real_job = JobPost(
            user_id=4,
            title="Real job",
            business_problem="Real requirement",
            employment_type="full_time",
            work_mode="remote",
            status="published",
        )
        db.add(real_job)
        await db.flush()
        from app.models import JobSkillRequirement

        db.add(
            JobSkillRequirement(
                job_id=real_job.id, skill_id=evidence.skill_id, requirement_type="must_have"
            )
        )
        await db.commit()
        match = await generate_candidate_match(db, real_job.id, candidate)
        # Preferences may add points; skill component must remain zero.
        assert "demo" not in match.explanation.lower()
        assert await db.scalar(select(func.count()).select_from(ArtifactAnalysis)) == 4
        assert Decimal(match.score_breakdown["score_breakdown"]["required"]) == 0
        assert Decimal(match.score_breakdown["score_breakdown"]["evidence"]) == 0
    finally:
        await stream.aclose()
