import logging

import pytest

from app.agents.job_descriptor.graph import build_job_descriptor_graph
from app.agents.job_descriptor.schemas import JobInput
from app.agents.shared.context import ModelContext
from app.agents.shared.contracts import SkillDefinition
from app.configs.database import get_db
from app.main import application
from app.models import User
from app.services import job_generation_service as service
from app.services.job_generation_service import GenerateJobInput, generate_job_description
from app.utils.exceptions import AppError

CATALOG = (SkillDefinition(id="1", canonical_name="FastAPI", aliases=["fast api"]),)
JOB = JobInput(business_problem="Kami butuh API internal dengan FastAPI dan MySQL.")


def draft(**updates):
    return {
        "suggested_title": "Backend Developer",
        "job_summary": "Bangun API internal",
        "job_description": "Membangun API internal dengan FastAPI.",
        "requirements": [
            {
                "skill_name": "FastAPI",
                "requirement_type": "must_have",
                "supporting_quote": "API internal dengan FastAPI",
            }
        ],
        **updates,
    }


class FakeModel:
    def __init__(self, *outputs):
        self.outputs = outputs
        self.calls = []

    async def generate(self, schema, prompt, payload):
        self.calls.append(payload)
        return schema.model_validate(self.outputs[min(len(self.calls) - 1, len(self.outputs) - 1)])


async def test_grounding_accepts_verbatim_quote_from_business_problem():
    result = (
        await build_job_descriptor_graph(ModelContext(FakeModel(draft()), CATALOG)).ainvoke(
            {"input": JOB}
        )
    )["result"]
    assert result.status == "draft"
    assert result.requirements[0].skill_id == "1"


async def test_grounding_accepts_verbatim_quote_from_employer_facts():
    job = JobInput(business_problem="Butuh API internal", employer_facts="Tim memakai FastAPI.")
    payload = draft()
    payload["requirements"][0]["supporting_quote"] = "Tim memakai FastAPI."
    result = (
        await build_job_descriptor_graph(ModelContext(FakeModel(payload), CATALOG)).ainvoke(
            {"input": job}
        )
    )["result"]
    assert result.status == "draft"


async def test_grounding_repair_requests_exact_copy_and_names_skill():
    payload = draft()
    payload["requirements"][0]["supporting_quote"] = "Tim memakai Django"
    model = FakeModel(payload)
    result = (
        await build_job_descriptor_graph(ModelContext(model, CATALOG)).ainvoke({"input": JOB})
    )["result"]
    assert result.draft is None
    assert result.status == "needs_review"


async def test_repair_feedback_is_specific_actionable_and_bounded():
    payload = draft()
    payload["requirements"][0]["supporting_quote"] = "Tim memakai Django"
    model = FakeModel(payload)
    result = (
        await build_job_descriptor_graph(ModelContext(model, CATALOG)).ainvoke({"input": JOB})
    )["result"]
    feedback = model.calls[1]["validation_feedback"]
    assert result.status == "needs_review"
    assert len(model.calls) == 2
    assert "FastAPI" in feedback[0]
    assert "missing_information" in feedback[0]


async def test_service_returns_safe_503_without_leaking_provider_detail(api, monkeypatch, caplog):
    class BrokenModel:
        async def generate(self, schema, prompt, payload):
            raise RuntimeError("provider token sk-live-should-not-leak")

    monkeypatch.setattr(service, "LangChainStructuredModel", BrokenModel)
    stream = application.dependency_overrides[get_db]()
    db = await anext(stream)
    try:
        with caplog.at_level(logging.WARNING):
            with pytest.raises(AppError) as error:
                await generate_job_description(
                    db,
                    GenerateJobInput(business_problem="Butuh API internal"),
                    await db.get(User, 3),
                )
        assert error.value.status_code == 503
        assert "sk-live-should-not-leak" not in error.value.message
        assert "sk-live-should-not-leak" not in str(error.value.errors)
        assert "sk-live-should-not-leak" not in caplog.text
        assert "RuntimeError" in caplog.text
    finally:
        await stream.aclose()


async def test_service_returns_draft_when_validation_passes(api, monkeypatch):
    class WorkingModel:
        async def generate(self, schema, prompt, payload):
            return schema.model_validate(draft())

    monkeypatch.setattr(service, "LangChainStructuredModel", WorkingModel)
    stream = application.dependency_overrides[get_db]()
    db = await anext(stream)
    try:
        result = await generate_job_description(
            db,
            GenerateJobInput(business_problem="Kami butuh API internal dengan FastAPI dan MySQL."),
            await db.get(User, 3),
        )
        assert result["draft"]["suggested_title"] == "Backend Developer"
        assert result["limitations"]
    finally:
        await stream.aclose()
