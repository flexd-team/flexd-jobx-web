from fastapi.responses import FileResponse

from app.schemas.artifact import ArtifactRead
from app.services.artifact_upload_service import download_artifact_file, upload_artifact
from app.utils.responses import item_response


async def upload(db, actor, request, title, kind, visibility, filename, description):
    record = await upload_artifact(
        db, actor, request, title, kind, visibility, filename, description
    )
    return item_response("Artifact uploaded", "artifact", ArtifactRead.model_validate(record))


async def download(db, artifact_id, actor):
    path, mime, filename = await download_artifact_file(db, artifact_id, actor)
    return FileResponse(
        path,
        media_type=mime,
        filename=filename,
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox",
        },
    )
