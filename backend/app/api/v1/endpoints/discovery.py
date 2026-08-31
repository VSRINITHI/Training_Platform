import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Header, status
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserInterest
from app.models.taxonomy import Domain, SubDomain
from app.models.course import Course
from app.models.enums import DifficultyLevel
from app.schemas.taxonomy import (
    DomainWithSubDomainsResponse,
    PersonalizedDiscoveryResponse,
)
from app.schemas.course import CourseResponse

router = APIRouter(prefix="/discovery", tags=["Course Discovery & Personalization"])


@router.get(
    "/taxonomy",
    response_model=List[DomainWithSubDomainsResponse],
    status_code=status.HTTP_200_OK,
    summary="Get full taxonomy catalog tree (Public)",
)
def get_taxonomy_tree(
    db: Session = Depends(get_db),
) -> List[DomainWithSubDomainsResponse]:
    """
    Public endpoint: Returns the full 2-tier taxonomy hierarchy (Domain -> Sub-Domains)
    for learner catalog browsing and interest onboarding.
    """
    domains = (
        db.query(Domain)
        .options(joinedload(Domain.sub_domains))
        .order_by(Domain.name.asc())
        .all()
    )
    return domains


@router.get(
    "/courses",
    response_model=PersonalizedDiscoveryResponse,
    status_code=status.HTTP_200_OK,
    summary="Discover courses with personalized interest matching (Public / Authenticated)",
)
def discover_courses(
    domain_id: Optional[uuid.UUID] = Query(None, description="Filter by Domain"),
    sub_domain_id: Optional[uuid.UUID] = Query(None, description="Filter by Sub-Domain"),
    difficulty: Optional[DifficultyLevel] = Query(None, description="Filter by difficulty"),
    search: Optional[str] = Query(None, description="Search course title/description"),
    personalized: bool = Query(True, description="Enable personalization if authenticated"),
    authorization: Optional[str] = Header(None, description="Optional Bearer token"),
    db: Session = Depends(get_db),
) -> PersonalizedDiscoveryResponse:
    """
    Personalized Course Discovery Engine:
    - If authenticated and learner has registered interests, prioritizes courses
      in the learner's selected sub-domains.
    - If unauthenticated or no interests set, returns all published courses matching filters.
    """
    interest_sub_ids: List[uuid.UUID] = []
    is_personalized = False

    # Optional authentication check from Bearer header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
        try:
            payload = decode_token(token)
            user_id_str = payload.get("sub")
            if user_id_str:
                user_id = uuid.UUID(user_id_str)
                # Fetch learner's saved interests
                interests = (
                    db.query(UserInterest.sub_domain_id)
                    .filter(UserInterest.user_id == user_id)
                    .all()
                )
                interest_sub_ids = [r[0] for r in interests]
        except Exception:
            # If token invalid, proceed with non-personalized flow
            pass

    # Base query: published courses only
    query = (
        db.query(Course)
        .options(joinedload(Course.sub_domain).joinedload(SubDomain.domain))
        .filter(Course.is_published == True)
    )

    # Explicit filters override interest matching
    if sub_domain_id:
        query = query.filter(Course.sub_domain_id == sub_domain_id)
    elif domain_id:
        query = query.join(SubDomain).filter(SubDomain.domain_id == domain_id)
    elif personalized and interest_sub_ids:
        # Match learner's selected interests
        query = query.filter(Course.sub_domain_id.in_(interest_sub_ids))
        is_personalized = True

    if difficulty:
        query = query.filter(Course.difficulty_level == difficulty)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (Course.title.ilike(search_term)) | (Course.description.ilike(search_term))
        )

    courses = query.order_by(Course.created_at.desc()).all()

    # If personalized yielded 0 results (e.g. no courses in interest area yet), fallback to all published
    if is_personalized and len(courses) == 0:
        fallback_query = (
            db.query(Course)
            .options(joinedload(Course.sub_domain).joinedload(SubDomain.domain))
            .filter(Course.is_published == True)
            .order_by(Course.created_at.desc())
        )
        if difficulty:
            fallback_query = fallback_query.filter(Course.difficulty_level == difficulty)
        courses = fallback_query.all()
        is_personalized = False

    course_items = [
        CourseResponse.model_validate(c) for c in courses
    ]

    return PersonalizedDiscoveryResponse(
        is_personalized=is_personalized,
        interest_sub_domain_ids=interest_sub_ids,
        matched_courses=course_items,
        total_matches=len(courses),
    )
