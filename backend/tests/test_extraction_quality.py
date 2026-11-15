from decimal import Decimal

import pytest

from app.agents.artifact_analysis.nodes import ArtifactContext, ArtifactNodes
from app.agents.artifact_analysis.quality import chunk_blocks, relevant_skills
from app.agents.artifact_analysis.schemas import ArtifactDraft
from app.agents.shared.context import ModelContext
from app.agents.shared.contracts import ArtifactContent, SkillDefinition, SourceBlock
from app.services.artifact_ingestion.dispatcher import ArtifactIngestor
from app.services.artifact_ingestion.github_reader import select_paths


async def test_chunked_generation_reads_every_block():
    from app.agents.artifact_analysis.schemas import ArtifactInput

    class Model:
        def __init__(self):
            self.blocks = []

        async def generate(self, schema, prompt, payload):
            batch = payload["content"]["source_locations"]
            self.blocks.extend(block["block_id"] for block in batch)
            return schema.model_validate({"summary": "Observed implementation", "evidence": []})

    model = Model()
    nodes = ArtifactNodes(ArtifactContext(ModelContext(model), ArtifactIngestor()))
    blocks = [
        SourceBlock(block_id=str(i), location=f"part:{i}", text="a" * 14000) for i in range(4)
    ]
    state = {
        "content": ArtifactContent(source_revision="r1", source_locations=blocks),
        "input": ArtifactInput(
            artifact_type="document",
            storage_key="local/example",
            candidate_role="Developer",
            contribution_description="Built project",
        ),
        "errors": [],
    }
    output = await nodes.analyze_artifact_with_contribution(state)
    assert model.blocks == ["0", "1", "2", "3"]
    assert output["draft"].summary == "Observed implementation"


def test_catalog_selects_relevant_skill_beyond_first_200():
    skills = tuple(SkillDefinition(id=str(i), canonical_name=f"Tool{i}") for i in range(400))
    selected = relevant_skills(skills, "Tool399 used for processing")
    assert selected[0].id == "399"
    assert len(selected) == 200


def test_chunks_preserve_all_citations_and_limit_calls():
    blocks = [
        SourceBlock(block_id=str(i), location=f"line:{i}", text="x" * 10000) for i in range(8)
    ]
    batches = chunk_blocks(blocks)
    assert len(batches) == 4
    assert [b.block_id for batch in batches for b in batch] == [str(i) for i in range(8)]
    with pytest.raises(ValueError, match="budget"):
        chunk_blocks(blocks, characters=10000, maximum=3)


def test_dynamic_source_selection_ignores_build_and_reserves_tests():
    tree = [
        {"path": path, "type": "blob", "size": 100}
        for path in [
            "backend/services/payment.py",
            "backend/tests/test_payment.py",
            "node_modules/fake/main.js",
            "dist/main.js",
            ".env",
            "README.md",
            "package.json",
            "src/custom-feature.ts",
        ]
    ]
    selected = {path: kind for path, kind, _ in select_paths(tree)}
    assert selected["backend/services/payment.py"] == "implementation"
    assert selected["backend/tests/test_payment.py"] == "test"
    assert "node_modules/fake/main.js" not in selected
    assert ".env" not in selected


def test_strongest_evidence_beats_first_manifest_and_keeps_support():
    skills = (SkillDefinition(id="1", canonical_name="Python"),)
    nodes = ArtifactNodes(ArtifactContext(ModelContext(object(), skills), ArtifactIngestor()))
    content = ArtifactContent(
        source_revision="commit",
        source_locations=[
            SourceBlock(
                block_id="manifest",
                location="pyproject.toml:1",
                text="Python",
                source_kind="manifest",
            ),
            SourceBlock(
                block_id="code",
                location="service.py:5",
                text="def validate(): return True",
                source_kind="implementation",
            ),
        ],
    )
    draft = ArtifactDraft.model_validate(
        {
            "summary": "Implementation reviewed",
            "evidence": [
                {
                    "skill_name": "Python",
                    "block_id": "manifest",
                    "evidence_excerpt": "Python",
                    "evidence_kind": "direct",
                    "confidence_score": "0.99",
                },
                {
                    "skill_name": "Python",
                    "block_id": "code",
                    "evidence_excerpt": "def validate(): return True",
                    "evidence_kind": "direct",
                    "confidence_score": "0.8",
                },
                {
                    "skill_name": "Python",
                    "block_id": "code",
                    "evidence_excerpt": "def validate(): return True",
                    "evidence_kind": "direct",
                    "confidence_score": "0.8",
                },
            ],
        }
    )
    state = {
        "content": content,
        "draft": draft,
        "canonical_ids": {"Python": "1"},
        "unresolved": [],
        "errors": [],
    }
    result = nodes.build_analysis_result(state)["result"]
    assert result.evidence[0].evidence_location == "service.py:5"
    assert result.evidence[0].confidence_score == Decimal("0.8")
    assert len(result.supporting_evidence) == 2
    assert result.supporting_evidence[0].evidence_kind == "inferred"
