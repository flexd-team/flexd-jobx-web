from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "flexd-jobx-web"
    app_env: Literal["local", "test", "production"] = "local"
    app_api_prefix: str = "/api/v1"
    app_cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    app_log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    app_login_rate_limit: int = Field(default=10, ge=1)
    app_login_window_seconds: int = Field(default=60, ge=1)
    app_register_rate_limit: int = Field(default=5, ge=1)
    app_register_window_seconds: int = Field(default=60, ge=1)
    app_github_client_id: str = ""
    app_github_client_secret: SecretStr = SecretStr("")
    app_github_callback_url: str = "http://localhost:8000/api/v1/auth/github/callback"
    app_github_frontend_callback_url: str = "http://localhost:5173/auth/github/callback"

    db_host: str = "127.0.0.1"
    db_port: int = Field(default=3306, ge=1, le=65535)
    db_name: str = "jobx"
    db_user: str = "flexd"
    db_password: SecretStr = SecretStr("")
    db_tls_enabled: bool = False
    db_connect_timeout_seconds: int = Field(default=10, ge=1, le=120)
    db_test_url: SecretStr = SecretStr("")

    jwt_secret_key: SecretStr
    jwt_algorithm: Literal["HS256"] = "HS256"
    jwt_issuer: str = "flexd-jobx-web"
    jwt_audience: str = "flexd-jobx-web"
    jwt_access_token_expire_minutes: int = Field(default=30, ge=1, le=1440)

    storage_cloud_provider: Literal["aws"] = "aws"
    storage_key: SecretStr = SecretStr("")
    storage_secret: SecretStr = SecretStr("")
    storage_region: str = "ap-southeast-1"
    storage_bucket: str = "flexd"
    storage_path: str = "/jobx"
    storage_public_url: str = "https://flexd.s3.ap-southeast-1.amazonaws.com/jobx"
    storage_acl: bool = False

    llm_api_key: SecretStr = SecretStr("")
    llm_base_url: str = ""
    llm_model: str = ""
    llm_temperature: float = Field(default=0.1, ge=0, le=2)
    llm_timeout_seconds: float = Field(default=60, gt=0, le=600)
    llm_max_retries: int = Field(default=2, ge=0, le=10)

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_secret(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET_KEY must contain at least 32 characters")
        return value

    @field_validator("app_api_prefix")
    @classmethod
    def validate_prefix(cls, value: str) -> str:
        if not value.startswith("/") or value.endswith("/"):
            raise ValueError("APP_API_PREFIX must start with / and have no trailing /")
        return value

    @model_validator(mode="after")
    def validate_production(self):
        if self.app_env == "production" and "*" in self.app_cors_origins:
            raise ValueError("Production CORS origins must be explicit")
        return self

    @property
    def database_url(self) -> URL:
        return URL.create(
            "mysql+asyncmy",
            username=self.db_user,
            password=self.db_password.get_secret_value(),
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
            query={"charset": "utf8mb4"},
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
