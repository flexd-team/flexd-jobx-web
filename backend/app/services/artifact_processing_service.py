"""Service for queueing and executing artifact analysis workflows."""

import logging

from sqlalchemy import select

from app.agents.artifact_analysis.graph import build_artifact_analysis_graph
from app.agents.artifact_analysis.nodes import ArtifactContext
from app.agents.artifact_analysis.schemas import ArtifactInput
from app.agents.shared.context import ModelContext
from app.agents.shared.contracts import SkillDefinition
from app.agents.shared.structured_output import LangChainStructuredModel
from app.configs.database import get_session_factory
from app.configs.settings import get_settings
from app.models import (
    Artifact,
    ArtifactAnalysis,
    ArtifactContribution,
    ArtifactSkillEvidence,
    Skill,
    SkillAlias,
    User,
)
from app.services.artifact_ingestion.contracts import ArtifactSourceError
from app.services.artifact_ingestion.dispatcher import ArtifactIngestor
from app.services.artifact_ingestion.github_reader import GitHubArtifactReader
from app.services.artifact_ingestion.local_reader import LocalArtifactReader, load_local_media
from app.utils.exceptions import AppError

logger = logging.getLogger(__name__)


def create_artifact_ingestor(artifact=None) -> ArtifactIngestor:
    if artifact is not None and artifact.storage_key and artifact.storage_key.startswith("local/"):
        return ArtifactIngestor(
            {
                artifact.artifact_type: LocalArtifactReader(
                    (artifact.metadata_json or {}).get("managed_file", {})
                )
            }
        )
    settings = get_settings()
    return ArtifactIngestor(
        {
            "github_repository": GitHubArtifactReader(
                token=settings.app_github_token.get_secret_value(),
                client_id=settings.app_github_client_id,
                client_secret=settings.app_github_client_secret.get_secret_value(),
            ),
        }
    )


async def queue_artifact_analysis(db, record_id: int, actor: User) -> ArtifactAnalysis:
    record = await db.scalar(
        select(Artifact)
        .where(Artifact.id == record_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if record is None:
        raise AppError(404, "Artifact not found", {"artifact": "Record does not exist"})
    if actor.account_type != "admin" and record.owner_user_id != actor.id:
        raise AppError(403, "Access denied", {"auth": "You do not own this artifact"})
    if not (record.source_url or record.storage_key):
        raise AppError(
            422, "Unsupported artifact source", {"artifact": "Source URL or file required"}
        )

    active = await db.scalar(
        select(ArtifactAnalysis.id)
        .where(
            ArtifactAnalysis.artifact_id == record_id,
            ArtifactAnalysis.analysis_status.in_(["queued", "processing"]),
        )
        .limit(1)
    )
    if active is not None:
        raise AppError(
            409, "Analysis already pending", {"artifact_analysis": "Wait for current analysis"}
        )

    analysis = ArtifactAnalysis(artifact_id=record_id, analysis_status="queued")
    record.processing_status = "queued"
    db.add(analysis)
    await db.flush()
    await db.refresh(analysis)
    await db.commit()
    return analysis


async def run_artifact_analysis(analysis_id: int):
    """Execute analysis asynchronously without blocking the client request."""
    factory = get_session_factory()
    settings = get_settings()

    async with factory() as db:
        analysis = await db.scalar(
            select(ArtifactAnalysis).where(ArtifactAnalysis.id == analysis_id).with_for_update()
        )
        if analysis is None or analysis.analysis_status != "queued":
            return

        artifact = await db.get(Artifact, analysis.artifact_id)
        if artifact is None:
            analysis.analysis_status = "failed"
            analysis.error_message = "Artifact record not found"
            await db.commit()
            return

        owner = await db.get(User, artifact.owner_user_id)
        if owner is None or owner.account_status != "active":
            analysis.analysis_status = "failed"
            analysis.error_message = "Owner is inactive"
            artifact.processing_status = "failed"
            await db.commit()
            return

        skills = list(await db.scalars(select(Skill).order_by(Skill.id).limit(5001)))
        aliases = list(await db.scalars(select(SkillAlias).order_by(SkillAlias.id).limit(20001)))
        if len(skills) > 5000 or len(aliases) > 20000:
            analysis.analysis_status = "needs_human_review"
            analysis.error_message = "Skill catalog exceeds analysis budget."
            artifact.processing_status = "needs_review"
            await db.commit()
            return
        aliases_by_skill = {}
        for alias in aliases:
            aliases_by_skill.setdefault(alias.skill_id, []).append(alias.alias_name)
        catalog = tuple(
            SkillDefinition(
                id=str(s.id),
                canonical_name=s.canonical_name,
                aliases=aliases_by_skill.get(s.id, []),
            )
            for s in skills
        )

        ingestor = create_artifact_ingestor(artifact)
        analysis.analysis_status = "processing"
        artifact.processing_status = "processing"
        await db.commit()

        contribution = await db.scalar(
            select(ArtifactContribution)
            .where(
                ArtifactContribution.artifact_id == artifact.id,
                ArtifactContribution.contributor_user_id == artifact.owner_user_id,
            )
            .limit(1)
        )
        candidate_role = (
            contribution.role_title if contribution and contribution.role_title else "Not declared"
        )
        contribution_desc = (
            contribution.contribution_description
            if contribution and contribution.contribution_description
            else (
                artifact.description
                or "No individual contribution declared; do not infer authorship."
            )
        )

        input_data = ArtifactInput(
            artifact_type=artifact.artifact_type,
            source_url=artifact.source_url,
            storage_key=artifact.storage_key,
            candidate_role=candidate_role,
            contribution_description=contribution_desc,
        )

    result = None
    error_msg = None
    try:
        model = LangChainStructuredModel(
            media_loader=load_local_media,
            max_media_bytes=settings.storage_max_upload_bytes,
            demo_fallback=settings.app_demo,
        )
        context = ArtifactContext(
            generation=ModelContext(model=model, skills=catalog),
            ingestor=ingestor,
        )
        graph = build_artifact_analysis_graph(context)
        out = await graph.ainvoke({"input": input_data})
        result = out.get("result")
    except ArtifactSourceError as exc:
        logger.warning("Artifact source read failed for analysis %s: %s", analysis_id, exc)
        error_msg = str(exc)
    except Exception:
        logger.exception("Artifact analysis failed for analysis %s", analysis_id)
        error_msg = (
            "Analysis failed. Check supported format, file budgets, and model configuration."
        )

    async with factory() as db:
        analysis = await db.scalar(
            select(ArtifactAnalysis).where(ArtifactAnalysis.id == analysis_id).with_for_update()
        )
        if analysis is None:
            return
        artifact = await db.scalar(
            select(Artifact).where(Artifact.id == analysis.artifact_id).with_for_update()
        )
        if analysis is None or artifact is None or analysis.analysis_status != "processing":
            return

        if result is None:
            analysis.analysis_status = "failed"
            analysis.error_message = error_msg or "AI analysis encountered an error."
            artifact.processing_status = "failed"
        else:
            analysis.analysis_status = (
                "completed" if result.status == "completed" else "needs_human_review"
            )
            artifact.processing_status = (
                "completed" if result.status == "completed" else "needs_review"
            )
            analysis.model_provider = "openai-compatible"
            analysis.model_name = settings.llm_model
            analysis.prompt_version = result.prompt_version
            analysis.extracted_summary = result.summary or f"Analysis of {artifact.title}"
            analysis.raw_result = result.model_dump(mode="json")
            if model.demo_used:
                from app.services.demo_data import DEMO_MARKER

                analysis.raw_result = {**analysis.raw_result, **DEMO_MARKER}
                analysis.model_provider = "demo"
                analysis.model_name = "synthetic-fallback-v1"
                analysis.analysis_status = "needs_human_review"
                artifact.processing_status = "needs_review"

            for ev in result.evidence:
                if model.demo_used:
                    break
                try:
                    db.add(
                        ArtifactSkillEvidence(
                            artifact_id=artifact.id,
                            analysis_id=analysis.id,
                            skill_id=int(ev.skill_id),
                            confidence_score=ev.confidence_score,
                            evidence_kind=ev.evidence_kind,
                            evidence_excerpt=ev.evidence_excerpt,
                            evidence_location=ev.evidence_location,
                            review_status="ai_suggested",
                        )
                    )
                except Exception:
                    pass

        await db.commit()
