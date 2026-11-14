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
                            "weight": str(req.weight),
                        }
                        for req in result.draft.requirements
                    ],
                },
                "limitations": result.limitations,
            }
    except Exception as exc:
        logger.warning("LLM Job Descriptor fallback invoked: %s", exc)

    # Heuristic fallback if LLM endpoint encounters an issue
    title = "Backend Engineer"
    lower_bp = schema.business_problem.lower()
    if "frontend" in lower_bp or "react" in lower_bp:
        title = "Frontend Developer"
    elif "fullstack" in lower_bp:
        title = "Fullstack Developer"
    elif "microservice" in lower_bp or "api" in lower_bp or "inventaris" in lower_bp:
        title = "Backend Engineer - Sistem Inventaris"

    detected_reqs = []
    for s in skills:
        name_lower = s.canonical_name.lower()
        if name_lower in lower_bp:
            detected_reqs.append(
                {
                    "skill_id": str(s.id),
                    "skill_name": s.canonical_name,
                    "requirement_type": "must_have",
                    "weight": "1.0",
                }
            )

    if not detected_reqs and skills:
        detected_reqs = [
            {
                "skill_id": str(skills[0].id),
                "skill_name": skills[0].canonical_name,
                "requirement_type": "must_have",
                "weight": "1.0",
            }
        ]

    summary = f"Membangun dan mengembangkan solusi sistem untuk: {schema.business_problem[:150]}..."
    desc = (
        f"## Tanggung Jawab\n"
        f"- Mengembangkan layanan andal untuk menyelesaikan: {schema.business_problem}\n"
        f"- Mengimplementasikan API, integrasi basis data, dan arsitektur handal.\n\n"
        f"## Kualifikasi\n"
        f"- Memiliki portofolio dan bukti kode yang dapat ditinjau.\n"
        f"- Berpengalaman dengan teknologi backend dan database modern."
    )
    return {
        "draft": {
            "suggested_title": title,
            "job_summary": summary,
            "job_description": desc,
            "requirements": detected_reqs,
        },
        "limitations": ["Generated via smart heuristic fallback"],
    }
