import hashlib
import io
import zipfile
from types import SimpleNamespace

import pytest

from app.agents.artifact_analysis.graph import build_artifact_analysis_graph
from app.agents.artifact_analysis.nodes import ArtifactContext
from app.agents.artifact_analysis.schemas import ArtifactDraft, ArtifactInput
from app.agents.shared.context import ModelContext
from app.agents.shared.contracts import SkillDefinition
from app.agents.shared.structured_output import LangChainStructuredModel
from app.configs.settings import get_settings
from app.services.artifact_ingestion.dispatcher import ArtifactIngestor
from app.services.artifact_ingestion.local_reader import LocalArtifactReader, load_local_media
from tests.test_artifact_files import sample


@pytest.mark.parametrize(
    "mime,block_type", [("application/pdf", "file"), ("video/mp4", "video_url")]
)
async def test_native_media_transport(mime, block_type):
    data = b"synthetic-transport-bytes"
    source = {
        "source_id": "media-1",
        "reference": "local/private",
        "filename": "test.pdf" if mime == "application/pdf" else "test.mp4",
        "mime_type": mime,
        "byte_size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }

    class Chat:
        def with_structured_output(self, schema, method):
            return self

        async def ainvoke(self, messages):
            assert messages[-1].content[1]["type"] == block_type
            return {"summary": "Transport confirmed", "evidence": []}

    async def loader(source):
        return data

    result = await LangChainStructuredModel(Chat(), media_loader=loader).generate(
        ArtifactDraft, "Analyze", {"content": {"media_sources": [source]}}
    )
    assert result.summary == "Transport confirmed"


async def test_media_hash_mismatch_never_calls_model():
    async def loader(source):
        return b"changed"

    with pytest.raises(ValueError, match="integrity"):
        await LangChainStructuredModel(object(), media_loader=loader).generate(
            ArtifactDraft,
            "Analyze",
            {"content": {"media_sources": [{"byte_size": 1, "sha256": "0" * 64}]}},
        )


@pytest.mark.parametrize(
    "extension,kind",
    [
        ("txt", "document"),
        ("csv", "spreadsheet"),
        ("docx", "document"),
        ("xlsx", "spreadsheet"),
        ("png", "image"),
        ("mp4", "video"),
    ],
)
async def test_reader_real_content(tmp_path, monkeypatch, extension, kind):
    monkeypatch.setattr(get_settings(), "storage_local_root", tmp_path)
    data = sample(extension)
    if extension == "docx":
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("[Content_Types].xml", "<Types/>")
            z.writestr(
                "word/document.xml",
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                "<w:p><w:t>Python API</w:t></w:p></w:document>",
            )
        data = buf.getvalue()
    if extension == "xlsx":
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("[Content_Types].xml", "<Types/>")
            z.writestr(
                "xl/workbook.xml",
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<sheets><sheet name="Budget" r:id="r1"/></sheets></workbook>',
            )
            z.writestr(
                "xl/_rels/workbook.xml.rels",
                '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/>'
                "</Relationships>",
            )
            z.writestr(
                "xl/worksheets/sheet1.xml",
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Python API</t></is></c>'
                "</row></sheetData></worksheet>",
            )
        data = buf.getvalue()
    key = "a" * 32
    (tmp_path / key).write_bytes(data)
    reader = LocalArtifactReader(
        {
            "filename": f"test.{extension}",
            "byte_size": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
    )
    content = await reader.read(SimpleNamespace(storage_key="local/" + key))
    if extension in {"png", "mp4"}:
        assert content.media_sources
        assert await load_local_media(content.media_sources[0].model_dump()) == data
    else:
        assert content.source_locations
    assert content.source_revision == hashlib.sha256(data).hexdigest()


async def test_adapter_sends_real_visual_block_and_graph_persists_observation(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(get_settings(), "storage_local_root", tmp_path)
    data = sample("png")
    key = "b" * 32
    (tmp_path / key).write_bytes(data)
    metadata = {
        "filename": "image.png",
        "byte_size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }

    class FakeChat:
        def with_structured_output(self, schema, method):
            return self

        async def ainvoke(self, messages):
            blocks = messages[-1].content
            assert blocks[1]["type"] == "image_url"
            assert blocks[1]["image_url"]["url"].startswith("data:image/png;base64,")
            assert "local/" not in blocks[0]["text"]
            return ArtifactDraft.model_validate(
                {
                    "summary": "Image observed",
                    "evidence": [
                        {
                            "skill_name": "Design",
                            "media_source_id": "media-1",
                            "observation": "A clear visual composition",
                            "evidence_kind": "direct",
                            "confidence_score": "0.8",
                        }
                    ],
                }
            )

    adapter = LangChainStructuredModel(FakeChat(), media_loader=load_local_media)
    context = ArtifactContext(
        ModelContext(adapter, (SkillDefinition(id="1", canonical_name="Design"),)),
        ArtifactIngestor({"image": LocalArtifactReader(metadata)}),
    )
    graph = build_artifact_analysis_graph(context)
    result = (
        await graph.ainvoke(
            {
                "input": ArtifactInput(
                    artifact_type="image",
                    storage_key="local/" + key,
                    candidate_role="Unknown",
                    contribution_description="No declared contribution",
                )
            }
        )
    )["result"]
    assert result.status == "completed"
    assert result.evidence[0].evidence_location == "media:media-1"
    assert result.evidence[0].evidence_excerpt.startswith(
        "[Model observation; human review required]"
    )
