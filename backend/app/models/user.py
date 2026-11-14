from sqlalchemy import Enum, String, text
from sqlalchemy.dialects.mysql import BIGINT, DATETIME
from sqlalchemy.orm import mapped_column

from app.models.base import Base


class User(Base):
    __tablename__ = "user"

    id = mapped_column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    name = mapped_column(String(150), nullable=False)
    email = mapped_column(String(255), nullable=False, unique=True)
    password_hash = mapped_column(String(255), nullable=True)
    account_type = mapped_column(Enum("candidate", "employer", "admin"), nullable=False)
    account_status = mapped_column(
        Enum("active", "inactive"), nullable=False, server_default="active"
    )
    created_at = mapped_column(DATETIME, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = mapped_column(
        DATETIME,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        server_onupdate=text("CURRENT_TIMESTAMP"),
    )
