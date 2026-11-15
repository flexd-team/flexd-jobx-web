"""Deterministic catalog selection, chunking and citation ranking, not skill inference."""

import re


def relevant_skills(skills, text, maximum=200):
    """Retain all for small catalogs, rank entire large catalogs by exact lexical mentions."""
    if len(skills) <= maximum:
        return skills
    lower = text.casefold()

    def score(skill):
        return sum(
            bool(re.search(r"(?<!\w)" + re.escape(name.casefold()) + r"(?!\w)", lower))
            for name in [skill.canonical_name, *skill.aliases]
        )

    return tuple(
        sorted(
            skills, key=lambda skill: (-score(skill), skill.canonical_name.casefold(), skill.id)
        )[:maximum]
    )


def chunk_blocks(blocks, characters=24000, maximum=6):
    batches, batch, size = [], [], 0
    for block in blocks:
        if batch and size + len(block.text) > characters:
            batches.append(batch)
            batch, size = [], 0
        batch.append(block)
        size += len(block.text)
    if batch:
        batches.append(batch)
    if len(batches) > maximum:
        raise ValueError("Artifact exceeds chunk request budget")
    return batches or [[]]


def citation_rank(evidence, blocks):
    block = blocks.get(evidence.block_id)
    strength = (
        {
            "implementation": 5,
            "test": 4,
            "content": 3,
            "documentation": 1,
            "manifest": 0,
            "metadata": -1,
        }.get(block.source_kind, 0)
        if block
        else 2
    )
    return (
        strength,
        evidence.evidence_kind == "direct",
        evidence.confidence_score,
        -len(evidence.evidence_excerpt),
        evidence.evidence_location,
    )
