import base64
import hashlib
import json
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel


class LangChainStructuredModel:
    """Lazy OpenAI-compatible adapter. Choose method supported by the actual endpoint."""

    def __init__(
        self,
        model=None,
        *,
        method: Literal["json_schema", "function_calling", "json_mode"] = "json_mode",
        media_loader=None,
        max_media_bytes: int = 20_000_000,
        demo_fallback: bool = False,
    ):
        self._model = model
        self.method = method
        self.media_loader = media_loader
        self.max_media_bytes = max_media_bytes
        self.demo_fallback = demo_fallback
        self.demo_used = False

    async def generate(self, schema: type[BaseModel], prompt: str, payload: dict) -> BaseModel:
        content_payload = dict(payload)
        artifact_content = dict(payload.get("content", {}))
        sources = artifact_content.get("media_sources", [])
        blocks = []
        total = 0
        for source in sources:
            if self.media_loader is None:
                raise ValueError("Media loader required")
            data = await self.media_loader(source)
            total += len(data)
            if (
                total > self.max_media_bytes
                or len(data) != source["byte_size"]
                or hashlib.sha256(data).hexdigest() != source["sha256"]
            ):
                raise ValueError("Media integrity or budget check failed")
            uri = f"data:{source['mime_type']};base64,{base64.b64encode(data).decode('ascii')}"
            if source["mime_type"].startswith("image/"):
                blocks.append({"type": "image_url", "image_url": {"url": uri}})
            elif source["mime_type"] == "video/mp4":
                blocks.append({"type": "video_url", "video_url": {"url": uri}})
            elif source["mime_type"] == "application/pdf":
                blocks.append(
                    {"type": "file", "file": {"filename": source["filename"], "file_data": uri}}
                )
            else:
                raise ValueError("Unsupported media MIME")
        if sources:
            artifact_content["media_sources"] = [
                {key: value for key, value in source.items() if key != "reference"}
                for source in sources
            ]
            content_payload["content"] = artifact_content
        messages = [
            SystemMessage(
                content=prompt + "\nOutput JSON schema: " + json.dumps(schema.model_json_schema())
            ),
            HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": json.dumps(content_payload, ensure_ascii=False, default=str),
                    },
                    *blocks,
                ]
                if blocks
                else json.dumps(payload, ensure_ascii=False, default=str)
            ),
        ]
        try:
            if self._model is None:
                from app.configs.llm import create_llm

                self._model = create_llm()
            runnable = self._model.with_structured_output(schema, method=self.method)
            result = await runnable.ainvoke(messages)
            return schema.model_validate(result)
        except Exception:
            if self.demo_fallback:
                from app.agents.artifact_analysis.schemas import ArtifactDraft
                from app.services.demo_data import DEMO_LABEL

                if schema is ArtifactDraft:
                    self.demo_used = True
                    return ArtifactDraft(summary=DEMO_LABEL, limitations=[DEMO_LABEL], evidence=[])
            if self.method != "json_mode":
                runnable = self._model.with_structured_output(schema, method="json_mode")
                result = await runnable.ainvoke(messages)
                return schema.model_validate(result)
            raise
