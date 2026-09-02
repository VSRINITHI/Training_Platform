from functools import lru_cache
from pathlib import Path
from typing import List, Optional, Union
from pydantic import computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "DataCaliper Training Platform API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Supabase credentials
    SUPABASE_URL: str = ""
    # Supabase Project JWT Secret (from Supabase Dashboard -> Settings -> API -> JWT Settings)
    SUPABASE_JWT_SECRET: Optional[str] = None
    # Supabase service-role key (used ONLY in backend — never exposed to frontend)
    SUPABASE_SECRET_KEY: Optional[str] = None

    # Frontend URL — used to construct redirect URLs in invitation emails
    FRONTEND_URL: str = "http://localhost:5173"

    # Application Email Sender Configuration (Set ONCE in backend environment)
    EMAIL_FROM_ADDRESS: str = "srinithi@gmail.com"
    EMAIL_FROM_NAME: str = "DataCaliper Training Platform"

    # Email provider type: "smtp" (default), "console", etc.
    EMAIL_PROVIDER: str = "smtp"

    # SMTP configuration for email delivery
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True

    # CORS configuration
    BACKEND_CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.BACKEND_CORS_ORIGINS, str):
            val = self.BACKEND_CORS_ORIGINS.strip()
            if val.startswith("[") and val.endswith("]"):
                import json
                try:
                    return json.loads(val)
                except Exception:
                    pass
            return [i.strip() for i in val.split(",") if i.strip()]
        return self.BACKEND_CORS_ORIGINS

    # PostgreSQL Database URL
    DATABASE_URL: str

    # Connection pooling settings
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    @computed_field  # type: ignore[misc]
    @property
    def jwks_url(self) -> str:
        """
        Returns the Supabase JWKS endpoint URL for ES256 / ECC public keys.
        """
        if self.SUPABASE_URL:
            return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        return ""

    @computed_field  # type: ignore[misc]
    @property
    def jwt_issuer(self) -> str:
        """
        Returns the expected Supabase JWT issuer claim (iss).
        """
        if self.SUPABASE_URL:
            return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1"
        return ""

    @computed_field  # type: ignore[misc]
    @property
    def jwt_secret(self) -> Optional[str]:
        """
        Returns the legacy Supabase JWT secret used to decode and verify HS256 tokens if configured.
        Prioritizes SUPABASE_JWT_SECRET, falling back to SUPABASE_SECRET_KEY.
        """
        return self.SUPABASE_JWT_SECRET or self.SUPABASE_SECRET_KEY

    @computed_field  # type: ignore[misc]
    @property
    def sync_database_uri(self) -> str:
        """
        Ensures the connection string uses the psycopg2 dialect for SQLAlchemy sync engine.
        Converts postgresql:// to postgresql+psycopg2:// if needed.
        """
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg2://", 1)
        if url.startswith("postgresql://") and not url.startswith("postgresql+"):
            return url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
