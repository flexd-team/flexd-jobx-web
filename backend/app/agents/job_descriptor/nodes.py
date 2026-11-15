from pydantic import ValidationError

from app.agents.job_descriptor.prompts import PROMPT_VERSION, SYSTEM_PROMPT
from app.agents.job_descriptor.schemas import (
    CanonicalRequirement,
    JobDraft,
    JobDraftResult,
    JobInput,
)
from app.agents.job_descriptor.state import JobState
from app.agents.shared.context import ModelContext, resolve_skill


class JobNodes:
    def __init__(self, context: ModelContext):
        self.context = context

    def validate_job_input(self, state: JobState):
        return {"input": JobInput.model_validate(state["input"]), "repairs": 0, "errors": []}

    async def generate_job_draft(self, state: JobState):
        try:
            value = await self.context.model.generate(
                JobDraft,
                SYSTEM_PROMPT,
                {
                    **state["input"].model_dump(),
                    "catalog": [s.model_dump() for s in self.context.skills],
                    "validation_feedback": state["errors"],
                },
            )
            return {"draft": JobDraft.model_validate(value), "errors": []}
        except ValidationError:
            return {"errors": ["Output does not conform to JobDraft schema."]}

    def normalize_requirements(self, state: JobState):
        if state["errors"]:
            return {}
        requirements = {}
        unresolved = []
        for item in state["draft"].requirements:
            skill = resolve_skill(item.skill_name, self.context.skills)
            if skill is None:
                unresolved.append(item.skill_name)
                continue
            requirements.setdefault(
                skill.id,
                CanonicalRequirement(
                    **item.model_dump(exclude={"skill_name"}),
                    skill_name=skill.canonical_name,
                    skill_id=skill.id,
                ),
            )
        return {"requirements": list(requirements.values()), "unresolved": sorted(set(unresolved))}

    def validate_grounding(self, state: JobState):
        if state["errors"]:
            return {}
        source = state["input"]
        allowed = f"{source.business_problem}\n{source.employer_facts or ''}"
        errors = [
            f"Requirement '{item.skill_name[:80]}' cites a quote that is not a verbatim "
            "substring of employer input. Copy exact source text, or omit the requirement "
            "and report the gap in missing_information."
            for item in state["draft"].requirements
            if not item.supporting_quote or item.supporting_quote not in allowed
        ]
        return {"errors": list(dict.fromkeys(errors))[:10]}

    def repair_draft(self, state: JobState):
        return {"repairs": state["repairs"] + 1}

    def build_draft_result(self, state: JobState):
        errors = state["errors"]
        return {
            "result": JobDraftResult(
                status="needs_review" if errors or state.get("unresolved") else "draft",
                prompt_version=PROMPT_VERSION,
                draft=None if errors else state["draft"],
                requirements=[] if errors else state["requirements"],
                unresolved_skills=state.get("unresolved", []),
                limitations=[
                    *errors,
                    "Generated prose requires employer review; quote validation "
                    "does not prove semantic grounding. No approval/publication performed.",
                ],
            )
        }
