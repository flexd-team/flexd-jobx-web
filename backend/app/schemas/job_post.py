from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.common import Input, Patch, Timestamps, UnsignedAmount, UnsignedId

Employment = Literal["full_time", "part_time", "contract", "internship", "freelance"]
WorkMode = Literal["onsite", "hybrid", "remote"]
JobStatus = Literal["draft", "published", "paused", "closed"]


class JobPostCreate(Input):
    user_id: UnsignedId
    title: str = Field(min_length=1, max_length=200)
    business_problem: str = Field(min_length=1)
    job_summary: str | None = None
    job_description: str | None = None
    employment_type: Employment
    work_mode: WorkMode
    city: str | None = Field(default=None, max_length=120)
    province: str | None = Field(default=None, max_length=120)
    country: str = Field(default="Indonesia", min_length=1, max_length=100)
    salary_min: UnsignedAmount | None = None
    salary_max: UnsignedAmount | None = None
    currency: str = Field(default="IDR", pattern=r"^[A-Z]{3}$")
    ai_generation_metadata: dict[str, Any] | None = None
    status: JobStatus = "draft"
    published_at: datetime | None = None
    closes_at: datetime | None = None


class JobPostUpdate(Patch):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    business_problem: str | None = Field(default=None, min_length=1)
    job_summary: str | None = None
    job_description: str | None = None
    employment_type: Employment | None = None
    work_mode: WorkMode | None = None
    city: str | None = Field(default=None, max_length=120)
    province: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, min_length=1, max_length=100)
    salary_min: UnsignedAmount | None = None
    salary_max: UnsignedAmount | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    ai_generation_metadata: dict[str, Any] | None = None
    status: JobStatus | None = None
    published_at: datetime | None = None
    closes_at: datetime | None = None


class JobPostRead(Timestamps):
    id: UnsignedId
    user_id: UnsignedId
    title: str
    business_problem: str
    job_summary: str | None
    job_description: str | None
    employment_type: str
    work_mode: str
    city: str | None
    province: str | None
    country: str
    salary_min: UnsignedAmount | None
    salary_max: UnsignedAmount | None
    currency: str
    ai_generation_metadata: dict[str, Any] | None
    status: str
    published_at: datetime | None
    closes_at: datetime | None
