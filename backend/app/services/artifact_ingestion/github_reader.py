"""Bounded, commit-pinned public GitHub source reader. Never executes repository code."""

import base64
import json
import re
from urllib.parse import quote, urlparse

import httpx

from app.agents.shared.contracts import ArtifactContent, SourceBlock
from app.services.artifact_ingestion.contracts import ArtifactSourceError

SECRET_REGEX = re.compile(
    r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"
    r"\bAKIA[A-Z0-9]{16}\b|\bgh[pousr]_[A-Za-z0-9_]+\b|"
    r'(?i:\b(?:password|api[_-]?key|secret|token)\s*[:=]\s*[\'"][^\'"]+[\'"])'
)
MANIFESTS = {
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "go.mod",
    "cargo.toml",
    "dockerfile",
    "docker-compose.yml",
    "pom.xml",
    "build.gradle",
    "package.swift",
}
EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".java",
    ".kt",
    ".go",
    ".rs",
    ".sql",
    ".swift",
    ".cs",
    ".rb",
    ".php",
    ".vue",
    ".html",
    ".css",
    ".tf",
    ".yaml",
    ".yml",
}
EXCLUDED = {
    "node_modules",
    "vendor",
    "dist",
    "build",
    "coverage",
    "__pycache__",
    "venv",
    ".venv",
    "fixtures",
    "generated",
    "migrations",
}
MAX_RESPONSE_BYTES = 2_000_000


def classify(path):
    lower = path.lower()
    name = lower.rsplit("/", 1)[-1]
    if name in MANIFESTS:
        return "manifest"
    if name.startswith("readme") or lower.endswith(".md"):
        return "documentation"
    if (
        any(part in {"tests", "test", "__tests__"} for part in lower.split("/"))
        or name.startswith("test_")
        or ".test." in name
    ):
        return "test"
    return "implementation"


def select_paths(tree, maximum=20):
    candidates = []
    for entry in tree:
        path = entry.get("path", "")
        parts = path.lower().split("/")
        name = parts[-1]
        if entry.get("type") != "blob" or entry.get("size", 0) > 100000:
            continue
        if any(part.startswith(".") or part in EXCLUDED for part in parts):
            continue
        if (
            name not in MANIFESTS
            and not name.startswith("readme")
            and not any(name.endswith(ext) for ext in EXTENSIONS)
        ):
            continue
        kind = classify(path)
        relevance = sum(
            word in name
            for word in (
                "service",
                "controller",
                "schema",
                "model",
                "route",
                "auth",
                "test",
                "main",
                "app",
            )
        )
        candidates.append((path, kind, relevance))
    selected = []
    # Reserve space for actual implementation and tests before contextual claims.
    for kind, quota in [("implementation", 12), ("test", 4), ("manifest", 2), ("documentation", 2)]:
        group = sorted(
            (item for item in candidates if item[1] == kind), key=lambda item: (-item[2], item[0])
        )
        selected.extend(group[:quota])
    return selected[:maximum]


class GitHubArtifactReader:
    def __init__(
        self, timeout=12.0, token=None, client_id=None, client_secret=None, transport=None
    ):
        self.timeout = timeout
        self.token = token or ""
        self.client_id = client_id or ""
        self.client_secret = client_secret or ""
        self.transport = transport

    def _parse_repo(self, url):
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.netloc not in {"github.com", "www.github.com"}:
            raise ArtifactSourceError("Only public HTTPS github.com repository URLs are supported.")
        parts = parsed.path.strip("/").split("/")
        if len(parts) < 2 or not all(re.fullmatch(r"[A-Za-z0-9_.-]+", part) for part in parts[:2]):
            raise ArtifactSourceError("Invalid GitHub repository path.")
        return parts[0], parts[1].removesuffix(".git")

    def _sanitize(self, text):
        return SECRET_REGEX.sub("[FILTERED_SECRET]", text)

    def _auth_headers(self):
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        if self.client_id and self.client_secret:
            credentials = base64.b64encode(
                f"{self.client_id}:{self.client_secret}".encode()
            ).decode("ascii")
            return {"Authorization": f"Basic {credentials}"}
        return {}

    def _raise_for_status(self, status, headers):
        if status in {403, 429}:
            if headers.get("x-ratelimit-remaining") == "0":
                raise ArtifactSourceError(
                    "GitHub API rate limit exceeded. Configure APP_GITHUB_TOKEN or retry "
                    "after the limit resets."
                )
            raise ArtifactSourceError(
                "GitHub denied the request. Use a public repository or a token with access."
            )
        if status == 404:
            raise ArtifactSourceError(
                "GitHub repository not found. Private repositories are not supported."
            )
        raise ArtifactSourceError(f"GitHub request failed with status {status}.")

    async def _get(self, client, url):
        try:
            async with client.stream("GET", url) as response:
                if response.status_code >= 400:
                    self._raise_for_status(response.status_code, response.headers)
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_RESPONSE_BYTES:
                        raise ArtifactSourceError("GitHub response exceeds the reader budget.")
                return bytes(body)
        except httpx.HTTPError as exc:
            raise ArtifactSourceError(
                "Unable to reach GitHub. Check network access and retry."
            ) from exc

    async def _get_json(self, client, url):
        try:
            return json.loads(await self._get(client, url))
        except json.JSONDecodeError as exc:
            raise ArtifactSourceError("GitHub returned an unreadable response.") from exc

    async def read(self, reference):
        owner, repo = self._parse_repo(reference.source_url or "")
        root = f"https://api.github.com/repos/{owner}/{repo}"
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "JobX-Artifact-Reader/2.0",
            **self._auth_headers(),
        }
        async with httpx.AsyncClient(
            timeout=self.timeout,
            follow_redirects=False,
            headers=headers,
            transport=self.transport,
        ) as client:
            metadata = await self._get_json(client, root)
            branch = metadata.get("default_branch") or "HEAD"
            commit = await self._get_json(client, root + "/commits/" + quote(branch, safe=""))
            sha = commit.get("sha", "")
            if not re.fullmatch(r"[a-f0-9]{40}", sha):
                raise ArtifactSourceError("GitHub returned an invalid commit identifier.")
            tree = await self._get_json(client, root + "/git/trees/" + sha + "?recursive=1")
            selected = select_paths(tree.get("tree", []))
            blocks, warnings = [], []
            used = 0
            if tree.get("truncated"):
                warnings.append("GitHub tree truncated; repository coverage is partial.")
            for path, kind, _ in selected:
                # raw.githubusercontent.com does not consume the REST API quota.
                raw_url = (
                    f"https://raw.githubusercontent.com/{owner}/{repo}/{sha}/"
                    f"{quote(path, safe='/')}"
                )
                try:
                    body = await self._get(client, raw_url)
                except ArtifactSourceError:
                    warnings.append(f"Selected source unavailable: {path}")
                    continue
                text = self._sanitize(body.decode("utf-8", errors="replace"))
                lines = text.splitlines(keepends=True)
                for offset in range(0, len(lines), 100):
                    segment = "".join(lines[offset : offset + 100])
                    if not segment.strip():
                        continue
                    if used + len(segment) > 100000 or len(blocks) >= 100:
                        warnings.append("Repository text budget reached; coverage is partial.")
                        break
                    end_line = offset + len(lines[offset : offset + 100])
                    blocks.append(
                        SourceBlock(
                            block_id=f"source-{len(blocks) + 1}",
                            location=f"{path}:{offset + 1}-{end_line}@{sha[:12]}",
                            text=segment,
                            source_kind=kind,
                        )
                    )
                    used += len(segment)
            if not blocks:
                raise ArtifactSourceError(
                    "No readable source files found. Metadata alone is not skill evidence."
                )
            return ArtifactContent(
                source_revision=sha,
                source_locations=blocks,
                limitations=["Selected source subset only; repository not exhaustively analyzed."],
                processing_warnings=list(dict.fromkeys(warnings)),
            )
