import base64

import httpx
import pytest

from app.agents.shared.contracts import ArtifactReference
from app.services.artifact_ingestion.contracts import ArtifactSourceError
from app.services.artifact_ingestion.github_reader import GitHubArtifactReader

SHA = "a" * 40
REFERENCE = ArtifactReference(
    artifact_type="github_repository", source_url="https://github.com/owner/repo"
)


def reader(handler, **kwargs):
    return GitHubArtifactReader(transport=httpx.MockTransport(handler), **kwargs)


def test_auth_headers_prefer_token_then_oauth_app_credentials():
    assert GitHubArtifactReader(token="t0ken")._auth_headers() == {"Authorization": "Bearer t0ken"}
    basic = GitHubArtifactReader(client_id="id", client_secret="secret")._auth_headers()[
        "Authorization"
    ]
    assert basic == "Basic " + base64.b64encode(b"id:secret").decode("ascii")
    assert GitHubArtifactReader()._auth_headers() == {}


async def test_reader_pins_commit_and_reads_files_from_raw_host():
    requested = []

    def handler(request):
        requested.append(str(request.url))
        path = request.url.path
        if path == "/repos/owner/repo":
            return httpx.Response(200, json={"default_branch": "main"})
        if path == "/repos/owner/repo/commits/main":
            return httpx.Response(200, json={"sha": SHA})
        if path == f"/repos/owner/repo/git/trees/{SHA}":
            return httpx.Response(
                200,
                json={
                    "tree": [
                        {"path": "README.md", "type": "blob", "size": 20},
                        {"path": "src/app.py", "type": "blob", "size": 40},
                    ]
                },
            )
        if request.url.host == "raw.githubusercontent.com":
            return httpx.Response(200, text="password = 'hunter2'\nprint('ok')\n")
        raise AssertionError(f"unexpected request: {request.url}")

    content = await reader(handler).read(REFERENCE)

    assert content.source_revision == SHA
    assert content.source_locations
    assert all(block.block_id.startswith("source-") for block in content.source_locations)
    assert all(SHA[:12] in block.location for block in content.source_locations)
    assert all("hunter2" not in block.text for block in content.source_locations)
    assert any(url.endswith(f"/{SHA}/src/app.py") for url in requested)


async def test_rate_limit_error_is_actionable():
    def handler(request):
        return httpx.Response(
            403, headers={"x-ratelimit-remaining": "0"}, json={"message": "rate limit"}
        )

    with pytest.raises(ArtifactSourceError, match="APP_GITHUB_TOKEN"):
        await reader(handler).read(REFERENCE)


async def test_missing_or_private_repository_is_reported():
    def handler(request):
        return httpx.Response(404, json={"message": "Not Found"})

    with pytest.raises(ArtifactSourceError, match="Private repositories are not supported"):
        await reader(handler).read(REFERENCE)


async def test_non_github_url_is_rejected():
    reference = ArtifactReference(
        artifact_type="github_repository", source_url="https://example.com/owner/repo"
    )

    with pytest.raises(ArtifactSourceError, match="github.com"):
        await reader(lambda request: httpx.Response(500)).read(reference)
