import io
import struct
import zipfile

import pytest
from PIL import Image

from app.configs.settings import get_settings
from app.utils.security import create_access_token


def sample(extension):
    if extension == "png":
        output = io.BytesIO()
        Image.new("RGB", (2, 2)).save(output, format="PNG")
        return output.getvalue()
    if extension == "mp4":
        return b"".join(
            struct.pack(">I4s", len(body) + 8, kind) + body
            for kind, body in [
                (b"ftyp", b"isom\x00\x00\x00\x00isom"),
                (b"moov", b""),
                (b"mdat", b"1234"),
            ]
        )
    if extension in {"docx", "xlsx"}:
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr(
                "word/document.xml" if extension == "docx" else "xl/workbook.xml", "<document/>"
            )
        return output.getvalue()
    return b"hello,world\n1,2"


@pytest.mark.parametrize(
    "kind,extension",
    [
        ("document", "txt"),
        ("document", "docx"),
        ("spreadsheet", "csv"),
        ("spreadsheet", "xlsx"),
        ("image", "png"),
        ("video", "mp4"),
    ],
)
async def test_upload_download_delete(api, monkeypatch, tmp_path, kind, extension):
    monkeypatch.setattr(get_settings(), "storage_local_root", tmp_path)
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    data = sample(extension)
    response = await api.post(
        f"/api/v1/my/artifacts/upload?title=File&artifact_type={kind}&filename=test.{extension}",
        content=data,
    )
    assert response.status_code == 201, response.text
    item = response.json()["data"]["artifact"]
    assert item["visibility"] == "private"
    assert item["source_url"] is None
    path = f"/api/v1/my/artifacts/{item['id']}"
    download = await api.get(path + "/file")
    assert download.content == data
    assert "no-store" in download.headers["cache-control"]
    assert download.headers["x-content-type-options"] == "nosniff"
    api.headers["Authorization"] = f"Bearer {create_access_token(3)}"
    assert (await api.get(path + "/file")).status_code == 403
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    assert (await api.delete(path)).status_code == 200
    assert list(tmp_path.iterdir()) == []


async def test_invalid_format_size_role(api, monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), "storage_local_root", tmp_path)
    url = "/api/v1/my/artifacts/upload?title=Bad&artifact_type=image&filename=fake.png"
    assert (await api.post(url, content=b"fake")).status_code == 403
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    assert (await api.post(url, content=b"fake")).status_code == 422
    assert (await api.post(url.replace("fake.png", "fake.exe"), content=b"fake")).status_code == 422
    monkeypatch.setattr(get_settings(), "storage_max_upload_bytes", 3)
    assert (await api.post(url, content=b"1234")).status_code == 413
    assert list(tmp_path.iterdir()) == []
