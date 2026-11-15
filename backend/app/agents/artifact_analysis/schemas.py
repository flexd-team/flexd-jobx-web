from decimal import Decimal
from typing import Literal

from pydantic import Field

from app.agents.shared.contracts import ArtifactReference, Contract


class ArtifactInput(ArtifactReference):
    candidate_role: str = Field(min_length=1, pattern=r"\S", max_length=300)
    contribution_description: str = Field(min_length=1, pattern=r"\S", max_length=10000)


class SuggestedEvidence(Contract):
    skill_name: str = Field(min_length=1)
    block_id: str = Field(default="")
    evidence_excerpt: str = Field(default="", max_length=2000)
    media_source_id: str | None = None
    observation: str | None = Field(default=None, max_length=2000)
    page_number: int | None = Field(default=None, ge=1)
    timestamp_seconds: Decimal | None = Field(default=None, ge=0, le=36000)
    evidence_kind: Literal["direct", "inferred"]
    confidence_score: Decimal = Field(ge=0, le=1, max_digits=5, decimal_places=4)


class ArtifactDraft(Contract):
    summary: str = Field(min_length=1)
    evidence: list[SuggestedEvidence] = Field(default_factory=list, max_length=300)
    limitations: list[str] = Field(default_factory=list)


class ValidatedEvidence(SuggestedEvidence):
    skill_id: str
    evidence_location: str
    review_status: Literal["ai_suggested"] = "ai_suggested"


class AnalysisResult(Contract):
    status: Literal["completed", "needs_review", "unsupported"]
    prompt_version: str
    source_revision: str | None = None
    summary: str = ""
    evidence: list[ValidatedEvidence] = Field(default_factory=list)
    unresolved_skills: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    supporting_evidence: list[ValidatedEvidence] = Field(default_factory=list)
