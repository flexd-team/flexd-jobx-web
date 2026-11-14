"""GitHub public repository reader for artifact ingestion."""

import base64
import re
from urllib.parse import urlparse

import httpx

from app.agents.shared.contracts import ArtifactContent, ArtifactReference, SourceBlock

SECRET_REGEX = re.compile(
    r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"
    r"\bAKIA[A-Z0-9]{16}\b|\bgh[pousr]_[A-Za-z0-9_]+\b|"
    r"(?i:\b(?:password|api[_-]?key|secret|token)\s*[:=]\s*['\"][^'\"]+['\"])"
)

MANIFEST_FILES = [
    "requirements.txt",
    "pyproject.toml",
    "Pipfile",
    "package.json",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "go.mod",
    "Cargo.toml",
]

ENTRY_FILES = [
    "main.py",
    "app.py",
    "app/main.py",
    "app/app.py",
    "src/index.ts",
    "src/index.js",
    "src/main.ts",
    "src/App.tsx",
    "server.js",
]


class GitHubArtifactReader:
    def __init__(self, timeout: float = 12.0):
        self.timeout = timeout

    def _parse_repo(self, url: str) -> tuple[str, str]:
        parsed = urlparse(url)
        if parsed.netloc not in {"github.com", "www.github.com"}:
            raise ValueError("Only github.com repository URLs are supported")
        parts = [p for p in parsed.path.strip("/").split("/") if p]
        if len(parts) < 2:
            raise ValueError("Invalid GitHub repository URL path")
        owner, repo = parts[0], parts[1]
        if repo.endswith(".git"):
            repo = repo[:-4]
        return owner, repo

    def _sanitize(self, text: str) -> str:
        return SECRET_REGEX.sub("[FILTERED_SECRET]", text)

    async def read(self, reference: ArtifactReference) -> ArtifactContent:
        if not reference.source_url:
            raise ValueError("Artifact source_url is required for GitHub repository")
        owner, repo = self._parse_repo(reference.source_url)

        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "JobX-Artifact-Reader/1.0",
        }

        async with httpx.AsyncClient(headers=headers, timeout=self.timeout) as client:
            repo_res = await client.get(f"https://api.github.com/repos/{owner}/{repo}")
            if repo_res.status_code != 200:
                err_md = (
                    f"# Repository {owner}/{repo}\nTidak dapat mengambil metadata dari GitHub API."
                )
                return ArtifactContent(
                    source_revision="unknown",
                    content_markdown=err_md,
                    source_locations=[
                        SourceBlock(
                            block_id="repo_info",
                            location="github.com",
                            text=f"Repository {owner}/{repo} (status {repo_res.status_code})",
                        )
                    ],
                    limitations=[f"GitHub API returned HTTP {repo_res.status_code}"],
                )

            repo_data = repo_res.json()
            default_branch = repo_data.get("default_branch", "main")
            description = repo_data.get("description") or "No description provided."
            language = repo_data.get("language") or "Unspecified"

            source_blocks: list[SourceBlock] = []
            markdown_parts = [
                f"# Repository: {owner}/{repo}",
                f"**Language**: {language}",
                f"**Branch**: {default_branch}",
                f"**Description**: {description}\n",
            ]

            # 1. Fetch README
            readme_res = await client.get(f"https://api.github.com/repos/{owner}/{repo}/readme")
            if readme_res.status_code == 200:
                readme_data = readme_res.json()
                try:
                    content_bytes = base64.b64decode(readme_data.get("content", ""))
                    readme_text = content_bytes.decode("utf-8", errors="replace")
                    readme_text = self._sanitize(readme_text[:12000])
                    source_blocks.append(
                        SourceBlock(
                            block_id="readme",
                            location=f"{readme_data.get('path', 'README.md')}:1",
                            text=readme_text,
                        )
                    )
                    readme_path = readme_data.get("path", "README.md")
                    markdown_parts.append(f"## README ({readme_path})\n{readme_text[:3000]}\n")
                except Exception:
                    pass

            # 2. Check manifest files in root and immediate subfolders
            manifest_found = 0
            for manifest_name in MANIFEST_FILES:
                if manifest_found >= 4:
                    break
                m_res = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/contents/{manifest_name}?ref={default_branch}"
                )
                if m_res.status_code == 200:
                    m_data = m_res.json()
                    if isinstance(m_data, dict) and "content" in m_data:
                        try:
                            m_text = base64.b64decode(m_data["content"]).decode(
                                "utf-8", errors="replace"
                            )
                            m_text = self._sanitize(m_text[:6000])
                            clean_tag = manifest_name.replace(".", "_").replace("-", "_")
                            source_blocks.append(
                                SourceBlock(
                                    block_id=f"manifest_{clean_tag}",
                                    location=f"{manifest_name}:1",
                                    text=m_text,
                                )
                            )
                            markdown_parts.append(
                                f"## Manifest: {manifest_name}\n```\n{m_text[:1500]}\n```\n"
                            )
                            manifest_found += 1
                        except Exception:
                            pass

            # 3. Check git tree to understand full repository structure
            tree_res = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
            )
            if tree_res.status_code == 200:
                tree_data = tree_res.json()
                paths = [
                    item["path"]
                    for item in tree_data.get("tree", [])
                    if item.get("type") in {"blob", "tree"}
                    and not item["path"].startswith((".", "node_modules", "vendor"))
                ][:60]
                if paths:
                    tree_text = "\n".join(paths)
                    source_blocks.append(
                        SourceBlock(
                            block_id="project_structure",
                            location="repository_tree:1",
                            text=tree_text,
                        )
                    )
                    markdown_parts.append(
                        f"## Project File Structure\n```\n{tree_text[:2000]}\n```\n"
                    )

            # 4. Check entry source files in root or service modules
            entry_found = 0
            for entry_name in ENTRY_FILES:
                if entry_found >= 2:
                    break
                e_res = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/contents/{entry_name}?ref={default_branch}"
                )
                if e_res.status_code == 200:
                    e_data = e_res.json()
                    if isinstance(e_data, dict) and "content" in e_data:
                        try:
                            e_text = base64.b64decode(e_data["content"]).decode(
                                "utf-8", errors="replace"
                            )
                            e_text = self._sanitize(e_text[:8000])
                            block_id = f"entry_{entry_name.replace('/', '_').replace('.', '_')}"
                            source_blocks.append(
                                SourceBlock(
                                    block_id=block_id,
                                    location=f"{entry_name}:1",
                                    text=e_text,
                                )
                            )
                            markdown_parts.append(
                                f"## Source: {entry_name}\n```\n{e_text[:2000]}\n```\n"
                            )
                            entry_found += 1
                        except Exception:
                            pass

            # If no blocks were extracted, provide a repo metadata block
            if not source_blocks:
                repo_desc = f"Repo {owner}/{repo}. Lang: {language}. Desc: {description}"
                source_blocks.append(
                    SourceBlock(
                        block_id="repo_summary",
                        location=f"{default_branch}/repository",
                        text=repo_desc,
                    )
                )

            return ArtifactContent(
                source_revision=f"branch-{default_branch}",
                content_markdown="\n".join(markdown_parts),
                source_locations=source_blocks,
                limitations=[]
                if source_blocks
                else ["Hanya metadata repository yang dapat diakses"],
            )
