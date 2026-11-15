"""Job description generation service powered by LLM and skill catalog."""

import logging

from pydantic import BaseModel, Field
from sqlalchemy import select

from app.agents.job_descriptor.graph import build_job_descriptor_graph
from app.agents.job_descriptor.schemas import JobInput
from app.agents.shared.context import ModelContext
from app.agents.shared.contracts import SkillDefinition
from app.agents.shared.structured_output import LangChainStructuredModel
from app.models.skill import Skill
from app.models.skill_alias import SkillAlias
from app.models.user import User
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
    catalog = tuple(
        SkillDefinition(
            id=str(s.id),
            canonical_name=s.canonical_name,
            aliases=[a.alias_name for a in aliases if a.skill_id == s.id],
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
    except Exception:
        logger.warning("Job description generation failed")
        raise AppError(
            503,
            "Draft generation unavailable",
            {"job_draft": "Check model configuration or write manually"},
        ) from None

    raise AppError(
        503, "Draft generation unavailable", {"job_draft": "No reviewable draft returned"}
    )
