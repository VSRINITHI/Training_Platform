from fastapi import APIRouter, status
from pydantic import BaseModel
from app.core.config import settings
from app.core.database import check_database_connection

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    project: str
    version: str
    database: dict[str, str | bool]


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Service and Database Health Check",
)
def health_check() -> HealthResponse:
    """
    Returns API status and verifies Supabase PostgreSQL connectivity
    using a non-mutating SELECT 1 query.
    """
    db_status = check_database_connection()
    overall_status = "healthy" if db_status.get("connected") else "degraded"
    return HealthResponse(
        status=overall_status,
        project=settings.PROJECT_NAME,
        version=settings.VERSION,
        database=db_status,
    )
