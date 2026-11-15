"""Job description generation service powered by LLM and skill catalog."""

import logging

from pydantic import BaseModel, Field
from sqlalchemy import select

from app.agents.job_descriptor.graph import build_job_descriptor_graph
from app.agents.job_descriptor.schemas import JobInput
from app.agents.shared.context import ModelContext
from app.agents.shared.contracts import SkillDefinition
from app.agents.shared.structured_output import LangChainStructuredModel
from app.configs.settings import get_settings
from app.models.skill import Skill
from app.models.skill_alias import SkillAlias
from app.models.user import User
from app.services.demo_data import demo_job_draft
from app.utils.exceptions import AppError

logger = logging.getLogger(__name__)


class GenerateJobInput(BaseModel):
    business_problem: str = Field(min_length=1, max_length=20000)
    employer_facts: str | None = Field(default=None, max_length=10000)


async def generate_job_description(db, schema: GenerateJobInput, actor: User):
    if actor.account_type not in {"employer", "admin"}:
        raise AppError(403, "Access denied", {"auth": "Employer access required"})

    skills = list(await db.scalars(select(Skill).order_by(Skill.id).limit(200)))
    aliases = list(await db.scalars(select(SkillAlias).order_by(SkillAlias.id).limit(1000)))
    aliases_by_skill: dict[int, list[str]] = {}
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

    prompt_input = JobInput(
        business_problem=schema.business_problem,
        employer_facts=schema.employer_facts or "",
    )

    try:
        model = LangChainStructuredModel()
        context = ModelContext(model=model, skills=catalog)
        graph = build_job_descriptor_graph(context)
        out = await graph.ainvoke({"input": prompt_input})
        result = out.get("result")
        if result and result.draft:
            return {
                "draft": {
                    "suggested_title": result.draft.suggested_title,
                    "job_summary": result.draft.job_summary,
                    "job_description": result.draft.job_description,
                    "requirements": [
                        {
                            "skill_id": req.skill_id,
                            "skill_name": req.skill_name,
                            "requirement_type": req.requirement_type,
                            "weight": "1.0",
                        }
                        for req in result.requirements
                    ],
                },
                "limitations": result.limitations,
            }
        logger.warning(
            "Job draft rejected by validation: status=%s limitations=%d",
            getattr(result, "status", None),
            len(getattr(result, "limitations", ())),
        )
    except Exception as exc:
        # Class name only: messages can embed request content or provider details.
        logger.warning("Job description generation failed (%s)", type(exc).__name__)

    if get_settings().app_demo:
        return demo_job_draft()
    raise AppError(
        503,
        "Draft generation unavailable",
        {
            "job_draft": "The model did not return a reviewable draft. "
            "Retry, check model configuration, or write the draft manually"
        },
    )
