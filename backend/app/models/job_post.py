from sqlalchemy import CheckConstraint, Enum, ForeignKey, String, Text, text
from sqlalchemy.dialects.mysql import BIGINT, CHAR, DATETIME, JSON, LONGTEXT
from sqlalchemy.orm import mapped_column

from app.models.base import Base


class JobPost(Base):
    __tablename__ = "job_post"
    __table_args__ = (
        CheckConstraint("salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max"),
    )

    id = mapped_column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    user_id = mapped_column(
        BIGINT(unsigned=True), ForeignKey("user.id", ondelete="RESTRICT"), nullable=False
    )
    title = mapped_column(String(200), nullable=False)
    business_problem = mapped_column(Text, nullable=False)
    job_summary = mapped_column(Text)
    job_description = mapped_column(LONGTEXT)
    employment_type = mapped_column(
        Enum("full_time", "part_time", "contract", "internship", "freelance"), nullable=False
    )
    work_mode = mapped_column(Enum("onsite", "hybrid", "remote"), nullable=False)
    city = mapped_column(String(120))
    province = mapped_column(String(120))
    country = mapped_column(String(100), nullable=False, server_default="Indonesia")
    salary_min = mapped_column(BIGINT(unsigned=True))
    salary_max = mapped_column(BIGINT(unsigned=True))
    currency = mapped_column(CHAR(3), nullable=False, server_default="IDR")
    ai_generation_metadata = mapped_column(JSON(none_as_null=True))
    status = mapped_column(
        Enum("draft", "published", "paused", "closed"),
        nullable=False,
        server_default="draft",
    )
    published_at = mapped_column(DATETIME)
    closes_at = mapped_column(DATETIME)
    created_at = mapped_column(DATETIME, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = mapped_column(
        DATETIME,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        server_onupdate=text("CURRENT_TIMESTAMP"),
    )
