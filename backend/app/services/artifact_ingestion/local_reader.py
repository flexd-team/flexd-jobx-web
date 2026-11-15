import asyncio
import csv
import hashlib
import io
import posixpath
import zipfile
from xml.etree import ElementTree as ET

from pypdf import PdfReader

from app.agents.shared.contracts import ArtifactContent, MediaBlock, SourceBlock
from app.configs.settings import get_settings
from app.services.artifact_upload_service import FORMATS, inspect_upload, managed_path


def xml(data):
    if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise ValueError("Unsafe XML")
    return ET.fromstring(data)


def read_bytes(key):
    with managed_path(key).open("rb") as stream:
        data = stream.read(get_settings().storage_max_upload_bytes + 1)
    if len(data) > get_settings().storage_max_upload_bytes:
        raise ValueError("File budget exceeded")
    return data


async def load_local_media(source):
    return await asyncio.to_thread(read_bytes, source["reference"])


class LocalArtifactReader:
    def __init__(self, metadata):
        self.metadata = metadata

    async def read(self, reference):
        return await asyncio.to_thread(self.extract, reference)

    def extract(self, reference):
        data = read_bytes(reference.storage_key)
        digest = hashlib.sha256(data).hexdigest()
        if digest != self.metadata.get("sha256") or len(data) != self.metadata.get("byte_size"):
            raise ValueError("File integrity mismatch")
        extension = self.metadata["filename"].rsplit(".", 1)[-1].lower()
        inspect_upload(data, extension)
        blocks, media, limitations = [], [], []

        def block(location, text):
            if text.strip():
                if (
                    len(blocks) >= 100
                    or sum(len(item.text) for item in blocks) + len(text) > 100000
                ):
                    raise ValueError("Text budget exceeded")
                blocks.append(
                    SourceBlock(block_id=f"block-{len(blocks) + 1}", location=location, text=text)
                )

        if extension in {"png", "jpg", "jpeg", "webp", "pdf", "mp4"}:
            pages = len(PdfReader(io.BytesIO(data)).pages) if extension == "pdf" else None
            media.append(
                MediaBlock(
                    source_id="media-1",
                    reference=reference.storage_key,
                    mime_type=FORMATS[extension][1],
                    filename=self.metadata["filename"],
                    sha256=digest,
                    byte_size=len(data),
                    page_count=pages,
                )
            )
            if extension == "mp4":
                limitations.append(
                    "Video observations are model-reported; "
                    "timestamps are not independently verified. "
                    "Audio comprehension is not guaranteed."
                )
        elif extension == "txt":
            for index, line in enumerate(data.decode("utf-8-sig").splitlines(), 1):
                block(f"line:{index}", line)
        elif extension == "csv":
            for index, row in enumerate(csv.reader(io.StringIO(data.decode("utf-8-sig"))), 1):
                block(f"CSV row:{index}", json_row(row))
        elif extension == "docx":
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                root = xml(archive.read("word/document.xml"))
                ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
                for index, paragraph in enumerate(root.findall(".//w:p", ns), 1):
                    block(
                        f"paragraph:{index}",
                        "".join(node.text or "" for node in paragraph.findall(".//w:t", ns)),
                    )
            limitations.append(
                "DOCX text/tables only; embedded images, layout, and comments not analyzed."
            )
        elif extension == "xlsx":
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                shared = []
                if "xl/sharedStrings.xml" in archive.namelist():
                    shared = [
                        "".join(node.itertext())
                        for node in xml(archive.read("xl/sharedStrings.xml")).findall("s:si", ns)
                    ]
                relationships = {
                    node.attrib["Id"]: node.attrib["Target"]
                    for node in xml(archive.read("xl/_rels/workbook.xml.rels"))
                }
                sheets = xml(archive.read("xl/workbook.xml")).findall("s:sheets/s:sheet", ns)
                for sheet in sheets:
                    target = relationships[
                        sheet.attrib[
                            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
                        ]
                    ]
                    path = (
                        posixpath.normpath("xl/" + target)
                        if not target.startswith("/")
                        else target.lstrip("/")
                    )
                    if not path.startswith("xl/worksheets/") or ".." in path:
                        raise ValueError("Invalid sheet path")
                    for row in xml(archive.read(path)).findall("s:sheetData/s:row", ns):
                        cells = []
                        for cell in row.findall("s:c", ns):
                            value = cell.findtext("s:v", default="", namespaces=ns)
                            if cell.attrib.get("t") == "s":
                                value = shared[int(value)]
                            elif cell.attrib.get("t") == "inlineStr":
                                value = "".join(cell.find("s:is", ns).itertext())
                            cells.append(f"{cell.attrib.get('r', '?')}={value}")
                        block(
                            f"sheet:{sheet.attrib['name']} row:{row.attrib.get('r', '?')}",
                            " | ".join(cells),
                        )
            limitations.append(
                "Spreadsheet cell values only; formulas/macros never executed; "
                "charts/images not analyzed. Cached formula values may be stale."
            )
        if not blocks and not media:
            raise ValueError("No readable content")
        return ArtifactContent(
            source_revision=digest,
            source_locations=blocks,
            media_sources=media,
            limitations=limitations,
        )


def json_row(row):
    import json

    return json.dumps(row, ensure_ascii=False)
