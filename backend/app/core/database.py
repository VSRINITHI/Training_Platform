import logging
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# Engine configuration with pre-ping for connection health checking
engine = create_engine(
    settings.sync_database_uri,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a SQLAlchemy database session per request.
    Ensures the session is cleanly closed after request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> dict[str, str | bool]:
    """
    Validates database connectivity by executing a lightweight SELECT 1 query.
    Does NOT create, alter, or query any application tables.
    """
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1")).scalar()
            if result == 1:
                return {"connected": True, "message": "Database connection successful"}
            return {"connected": False, "message": "Unexpected response from database"}
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return {"connected": False, "message": str(e)}
