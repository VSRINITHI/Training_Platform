from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    auth,
    domains,
    sub_domains,
    interests,
    discovery,
    courses,
    modules,
    lessons,
    quizzes,
    enrollments,
    progress,
    certificates,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router)
api_router.include_router(domains.router)
api_router.include_router(sub_domains.router)
api_router.include_router(interests.router)
api_router.include_router(discovery.router)
api_router.include_router(courses.router)
api_router.include_router(modules.router)
api_router.include_router(lessons.router)
api_router.include_router(quizzes.router)
api_router.include_router(enrollments.router)
api_router.include_router(progress.router)
api_router.include_router(certificates.router)
