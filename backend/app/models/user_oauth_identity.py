from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.dialects.mysql import BIGINT, DATETIME
from sqlalchemy.orm import mapped_column

from app.models.base import Base


class UserOAuthIdentity(Base):
    __tablename__ = "user_oauth_identity"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_identity"),
        UniqueConstraint("user_id", "provider", name="uq_oauth_user_provider"),
    )

    id = mapped_column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    user_id = mapped_column(
        BIGINT(unsigned=True), ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    provider = mapped_column(Enum("github"), nullable=False)
    provider_user_id = mapped_column(String(255), nullable=False)
    created_at = mapped_column(DATETIME, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
