"""Explicit operator script to seed canonical skills and aliases. Idempotent."""

import asyncio

from sqlalchemy import select

from app.configs.database import get_session_factory
from app.models.skill import Skill
from app.models.skill_alias import SkillAlias

SKILLS_DATA = [
    {
        "canonical_name": "Python",
        "slug": "python",
        "category": "Programming Language",
        "description": "High-level programming language used in backend, data science, and AI.",
        "aliases": ["py", "python3", "python 3"],
    },
    {
        "canonical_name": "FastAPI",
        "slug": "fastapi",
        "category": "Backend Framework",
        "description": "Fast web framework for building APIs with Python based on type hints.",
        "aliases": ["fast api", "fastapi framework"],
    },
    {
        "canonical_name": "MySQL",
        "slug": "mysql",
        "category": "Database",
        "description": "Open-source relational database management system.",
        "aliases": ["mysql db", "mysql database", "mysql server"],
    },
    {
        "canonical_name": "PostgreSQL",
        "slug": "postgresql",
        "category": "Database",
        "description": "Powerful, open source object-relational database system.",
        "aliases": ["postgres", "pgsql"],
    },
    {
        "canonical_name": "REST API",
        "slug": "rest-api",
        "category": "Architecture & Networking",
        "description": "REST architectural style for distributed hypermedia systems.",
        "aliases": ["restful api", "restful", "rest apis", "rest endpoints"],
    },
    {
        "canonical_name": "Docker",
        "slug": "docker",
        "category": "DevOps & Infrastructure",
        "description": "Platform designed to help developers build, share, and run containers.",
        "aliases": ["docker container", "dockerfile", "docker compose"],
    },
    {
        "canonical_name": "React",
        "slug": "react",
        "category": "Frontend Framework",
        "description": "The library for web and native user interfaces.",
        "aliases": ["reactjs", "react.js", "react js"],
    },
    {
        "canonical_name": "TypeScript",
        "slug": "typescript",
        "category": "Programming Language",
        "description": "Typed superset of JavaScript that compiles to plain JavaScript.",
        "aliases": ["ts"],
    },
    {
        "canonical_name": "JavaScript",
        "slug": "javascript",
        "category": "Programming Language",
        "description": "High-level, interpreted programming language of the Web.",
        "aliases": ["js", "es6", "vanilla js"],
    },
    {
        "canonical_name": "Next.js",
        "slug": "nextjs",
        "category": "Frontend Framework",
        "description": "React framework enabling server-side rendering and static web apps.",
        "aliases": ["next.js", "next js"],
    },
    {
        "canonical_name": "Tailwind CSS",
        "slug": "tailwind-css",
        "category": "Frontend Styling",
        "description": "Utility-first CSS framework packed with classes.",
        "aliases": ["tailwind", "tailwindcss"],
    },
    {
        "canonical_name": "Redis",
        "slug": "redis",
        "category": "Database & Caching",
        "description": "In-memory data store used as a database, cache, and message broker.",
        "aliases": ["redis cache", "redis in-memory"],
    },
    {
        "canonical_name": "Git",
        "slug": "git",
        "category": "Tools & Version Control",
        "description": "Distributed version control system for tracking changes in source code.",
        "aliases": ["github", "git vcs", "gitlab"],
    },
    {
        "canonical_name": "Node.js",
        "slug": "nodejs",
        "category": "Runtime Environment",
        "description": "Asynchronous event-driven JavaScript runtime environment.",
        "aliases": ["node.js", "node js", "node"],
    },
    {
        "canonical_name": "SQLAlchemy",
        "slug": "sqlalchemy",
        "category": "Backend Library",
        "description": "Python SQL toolkit and Object Relational Mapper (ORM).",
        "aliases": ["sqlalchemy orm", "async sqlalchemy"],
    },
    {
        "canonical_name": "Pydantic",
        "slug": "pydantic",
        "category": "Backend Library",
        "description": "Data validation and settings management using Python type annotations.",
        "aliases": ["pydantic v2", "pydantic validation"],
    },
    {
        "canonical_name": "Microservices",
        "slug": "microservices",
        "category": "Architecture",
        "description": "Software architecture composed of small independent modular services.",
        "aliases": ["microservice", "microservice architecture"],
    },
    {
        "canonical_name": "Linux",
        "slug": "linux",
        "category": "Operating System",
        "description": "Open-source Unix-like operating system kernel.",
        "aliases": ["ubuntu", "debian", "bash scripting"],
    },
    {
        "canonical_name": "AWS",
        "slug": "aws",
        "category": "Cloud & Infrastructure",
        "description": "Amazon Web Services comprehensive cloud computing platform.",
        "aliases": ["amazon web services", "aws s3", "aws ec2"],
    },
    {
        "canonical_name": "CI/CD",
        "slug": "ci-cd",
        "category": "DevOps",
        "description": "Continuous Integration and Continuous Delivery / Deployment.",
        "aliases": ["github actions", "continuous integration", "gitlab ci"],
    },
]


async def seed():
    factory = get_session_factory()
    try:
        async with factory() as db:
            print("Checking existing skills...")
            added_skills = 0
            added_aliases = 0
            for item in SKILLS_DATA:
                existing_skill = await db.scalar(select(Skill).where(Skill.slug == item["slug"]))
                if existing_skill is None:
                    skill = Skill(
                        canonical_name=item["canonical_name"],
                        slug=item["slug"],
                        category=item.get("category"),
                        description=item.get("description"),
                        taxonomy_source="jobx_default_catalog",
                    )
                    db.add(skill)
                    await db.flush()
                    await db.refresh(skill)
                    added_skills += 1
                else:
                    skill = existing_skill

                for alias in item.get("aliases", []):
                    norm = alias.strip().casefold()
                    existing_alias = await db.scalar(
                        select(SkillAlias).where(SkillAlias.normalized_alias == norm)
                    )
                    if existing_alias is None:
                        sa = SkillAlias(
                            skill_id=skill.id,
                            alias_name=alias.strip(),
                            normalized_alias=norm,
                        )
                        db.add(sa)
                        added_aliases += 1

            await db.commit()
            msg = f"Seeding completed: {added_skills} skills, {added_aliases} aliases added."
            print(msg)
    finally:
        await factory.kw["bind"].dispose()
        get_session_factory.cache_clear()


if __name__ == "__main__":
    asyncio.run(seed())
