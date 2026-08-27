from functools import lru_cache
from pathlib import Path
from pydantic import computed_field
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
    SUPABASE_URL: str
    SUPABASE_SECRET_KEY: str

    # PostgreSQL Database URL
    DATABASE_URL: str

    # Connection pooling settings
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

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
