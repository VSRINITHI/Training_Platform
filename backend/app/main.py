from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.storage import ensure_storage_buckets
from app.api.v1.router import api_router
from app.api.v1.endpoints.health import health_check


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure storage buckets exist on startup
    try:
        ensure_storage_buckets()
    except Exception:
        pass
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# Configure CORS for local development and frontend client
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory for local fallback file uploads
static_dir = Path(__file__).resolve().parent.parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Root-level health check for load balancers / monitoring
app.get("/health", tags=["Health"], include_in_schema=False)(health_check)

# Versioned API routes (/api/v1/...)
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root_endpoint():
    return {
        "message": "Welcome to DataCaliper Training Platform API",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": "/health",
    }

