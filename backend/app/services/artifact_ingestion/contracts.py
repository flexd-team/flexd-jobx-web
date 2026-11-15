from typing import Protocol

from app.agents.shared.contracts import ArtifactContent, ArtifactReference


class ArtifactSourceError(Exception):
    """Reader failure with a user-safe, actionable message."""


class ArtifactReader(Protocol):
    async def read(self, reference: ArtifactReference) -> ArtifactContent:
        """Return bounded content and real citations; do not execute source content.

        Implementations must validate sources/MIME, restrict redirects and network targets,
        filter sensitive paths, enforce download/decompression/time budgets, and exclude
        macros/external resources before returning content. Credentials must not be returned.
        """
        ...
