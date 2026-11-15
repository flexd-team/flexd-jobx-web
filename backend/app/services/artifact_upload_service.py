"""Private local storage; never expose this directory as static files."""

import asyncio
import hashlib
import io
import re
import struct
import uuid
import zipfile
from pathlib import PurePosixPath
from xml.etree import ElementTree

from PIL import Image
from pypdf import PdfReader
from sqlalchemy.exc import DBAPIError

from app.configs.settings import get_settings
from app.models import Artifact
from app.services.artifact_detail_service import get_owned_artifact
from app.utils.database_errors import translate_database_error
from app.utils.exceptions import AppError

FORMATS = {
    "pdf": ("document", "application/pdf"),
    "docx": ("document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    "txt": ("document", "text/plain"),
    "xlsx": ("spreadsheet", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "csv": ("spreadsheet", "text/csv"),
    "png": ("image", "image/png"),
    "jpg": ("image", "image/jpeg"),
    "jpeg": ("image", "image/jpeg"),
    "webp": ("image", "image/webp"),
    "mp4": ("video", "video/mp4"),
}


def managed_path(key):
    if not re.fullmatch(r"local/[a-f0-9]{32}", key or ""):
        raise AppError(404, "File not found", {"file": "No managed file"})
    path = get_settings().storage_local_root.resolve() / key.split("/")[1]
    if path.is_symlink():
        raise AppError(404, "File not found", {"file": "No managed file"})
    return path


def inspect_upload(data: bytes, extension: str):
    try:
        if extension in {"png", "jpg", "jpeg", "webp"}:
            with Image.open(io.BytesIO(data)) as image:
                expected = {"png": "PNG", "jpg": "JPEG", "jpeg": "JPEG", "webp": "WEBP"}
                if image.format != expected[extension] or image.width * image.height > 25_000_000:
                    raise ValueError
                image.verify()
        elif extension == "pdf":
            reader = PdfReader(io.BytesIO(data))
            if (
                not data.startswith(b"%PDF-")
                or reader.is_encrypted
                or not 0 < len(reader.pages) <= 100
            ):
                raise ValueError
        elif extension in {"txt", "csv"}:
            text = data.decode("utf-8-sig")
            if not text.strip() or any(ord(char) < 32 and char not in "\n\r\t" for char in text):
                raise ValueError
        elif extension in {"docx", "xlsx"}:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                entries = archive.infolist()
                if len(entries) > 2000 or sum(entry.file_size for entry in entries) > 100_000_000:
                    raise ValueError
                for entry in entries:
                    parts = PurePosixPath(entry.filename).parts
                    if entry.flag_bits & 1 or entry.filename.startswith("/") or ".." in parts:
                        raise ValueError
                    if (
                        entry.file_size > 20_000_000
                        or entry.file_size > max(1, entry.compress_size) * 200
                    ):
                        raise ValueError
                    if entry.filename.lower().endswith(("vbaproject.bin", ".exe", ".dll")):
                        raise ValueError
                required = "word/document.xml" if extension == "docx" else "xl/workbook.xml"
                content = archive.read(required)
                types = archive.read("[Content_Types].xml")
                for xml in (content, types):
                    if b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
                        raise ValueError
                    ElementTree.fromstring(xml)
        elif extension == "mp4":
            offset, kinds = 0, set()
            while offset < len(data):
                if len(data) - offset < 8:
                    raise ValueError
                size, kind = struct.unpack_from(">I4s", data, offset)
                header = 8
                if size == 1:
                    if len(data) - offset < 16:
                        raise ValueError
                    size = struct.unpack_from(">Q", data, offset + 8)[0]
                    header = 16
                if size == 0:
                    size = len(data) - offset
                if size < header or offset + size > len(data):
                    raise ValueError
                if kind == b"ftyp" and (
                    size < header + 8
                    or data[offset + header : offset + header + 4]
                    not in {b"isom", b"iso2", b"mp41", b"mp42", b"avc1", b"M4V "}
                ):
                    raise ValueError
                kinds.add(kind)
                offset += size
            if not {b"ftyp", b"moov", b"mdat"} <= kinds or data[4:8] != b"ftyp":
                raise ValueError
        else:
            raise ValueError
    except Exception:
        raise AppError(
            422,
            "Invalid file",
            {"file": "File content does not match supported format or safety limits"},
        ) from None


async def upload_artifact(db, actor, request, title, kind, visibility, filename, description):
    if actor.account_type != "candidate":
        raise AppError(403, "Access denied", {"auth": "Candidate account required"})
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in FORMATS or FORMATS[extension][0] != kind:
        raise AppError(422, "Unsupported file", {"file": "Choose a file matching artifact type"})
    limit = get_settings().storage_max_upload_bytes
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > limit:
            raise AppError(413, "File too large", {"file": "Configured upload limit exceeded"})
        data.extend(chunk)
    if not data:
        raise AppError(422, "Empty file", {"file": "Select a nonempty file"})
    await asyncio.to_thread(inspect_upload, bytes(data), extension)
    key = "local/" + uuid.uuid4().hex
    path = managed_path(key)
    safe_name = re.sub(r"[^\w. -]", "_", filename.replace("\\", "/").split("/")[-1])[:150]
    record = Artifact(
        owner_user_id=actor.id,
        title=title,
        artifact_type=kind,
        description=description,
        visibility=visibility,
        storage_key=key,
        mime_type=FORMATS[extension][1],
        metadata_json={
            "managed_file": {
                "filename": safe_name,
                "byte_size": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        },
    )

    def write():
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as stream:
            stream.write(data)
        path.chmod(0o600)

    try:
        await asyncio.to_thread(write)
        db.add(record)
        await db.flush()
        await db.refresh(record)
        await db.commit()
        return record
    except BaseException as exc:
        await db.rollback()
        await asyncio.to_thread(path.unlink, missing_ok=True)
        if isinstance(exc, DBAPIError):
            raise translate_database_error(exc, "artifact") from None
        raise


async def download_artifact_file(db, artifact_id, actor):
    record = await get_owned_artifact(db, artifact_id, actor)
    path = managed_path(record.storage_key)
    if not await asyncio.to_thread(path.is_file):
        raise AppError(404, "File not found", {"file": "File no longer available"})
    metadata = (record.metadata_json or {}).get("managed_file", {})
    return path, record.mime_type, metadata.get("filename", f"artifact-{record.id}")
