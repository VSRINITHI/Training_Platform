import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from app.core.dependencies import get_db, require_role
from app.models.user import User
from app.models.taxonomy import Domain, SubDomain
from app.models.course import Course
from app.models.enums import UserRole
from app.schemas.taxonomy import (
    SubDomainCreate,
    SubDomainUpdate,
    SubDomainResponse,
    SubDomainDetailResponse,
)
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/sub-domains", tags=["Sub-Domains (Taxonomy)"])


@router.get(
    "",
    response_model=List[SubDomainDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="List sub-domains (Public)",
)
def list_sub_domains(
    domain_id: Optional[uuid.UUID] = Query(None, description="Filter sub-domains by parent domain ID"),
    db: Session = Depends(get_db),
) -> List[SubDomainDetailResponse]:
    """
    Public endpoint: Lists sub-domains, optionally filtered by parent domain.
    Includes parent domain details and published course counts.
    """
    query = db.query(SubDomain).options(joinedload(SubDomain.domain))
    if domain_id:
        query = query.filter(SubDomain.domain_id == domain_id)

    sub_domains = query.order_by(SubDomain.name.asc()).all()

    # Calculate published course counts per sub-domain
    results = []
    for sd in sub_domains:
        published_count = (
            db.query(Course)
            .filter(Course.sub_domain_id == sd.id, Course.is_published == True)
            .count()
        )
        sd_dict = {
            "id": sd.id,
            "domain_id": sd.domain_id,
            "name": sd.name,
            "slug": sd.slug,
            "description": sd.description,
            "created_at": sd.created_at,
            "domain": sd.domain,
            "published_course_count": published_count,
        }
        results.append(sd_dict)

    return results


@router.get(
    "/{sub_domain_identifier}",
    response_model=SubDomainDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get sub-domain by ID or slug (Public)",
)
def get_sub_domain(
    sub_domain_identifier: str,
    db: Session = Depends(get_db),
) -> SubDomainDetailResponse:
    """
    Public endpoint: Retrieves a sub-domain by UUID or slug with parent domain info.
    """
    try:
        sd_id = uuid.UUID(sub_domain_identifier)
        sub_domain = (
            db.query(SubDomain)
            .options(joinedload(SubDomain.domain))
            .filter(SubDomain.id == sd_id)
            .first()
        )
    except ValueError:
        sub_domain = (
            db.query(SubDomain)
            .options(joinedload(SubDomain.domain))
            .filter(SubDomain.slug == sub_domain_identifier)
            .first()
        )

    if not sub_domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-domain '{sub_domain_identifier}' not found",
        )

    published_count = (
        db.query(Course)
        .filter(Course.sub_domain_id == sub_domain.id, Course.is_published == True)
        .count()
    )

    return {
        "id": sub_domain.id,
        "domain_id": sub_domain.domain_id,
        "name": sub_domain.name,
        "slug": sub_domain.slug,
        "description": sub_domain.description,
        "created_at": sub_domain.created_at,
        "domain": sub_domain.domain,
        "published_course_count": published_count,
    }


@router.post(
    "",
    response_model=SubDomainResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create sub-domain (Admin only)",
)
def create_sub_domain(
    sub_domain_in: SubDomainCreate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> SubDomainResponse:
    """
    Admin endpoint: Creates a new sub-domain under a parent domain.
    """
    parent_domain = db.query(Domain).filter(Domain.id == sub_domain_in.domain_id).first()
    if not parent_domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parent domain with ID '{sub_domain_in.domain_id}' does not exist",
        )

    existing_slug = db.query(SubDomain).filter(SubDomain.slug == sub_domain_in.slug).first()
    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sub-domain with slug '{sub_domain_in.slug}' already exists",
        )

    sub_domain = SubDomain(
        domain_id=sub_domain_in.domain_id,
        name=sub_domain_in.name,
        slug=sub_domain_in.slug,
        description=sub_domain_in.description,
    )
    db.add(sub_domain)
    db.commit()
    db.refresh(sub_domain)
    return sub_domain


@router.patch(
    "/{sub_domain_id}",
    response_model=SubDomainResponse,
    status_code=status.HTTP_200_OK,
    summary="Update sub-domain (Admin only)",
)
def update_sub_domain(
    sub_domain_id: uuid.UUID,
    sub_domain_update: SubDomainUpdate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> SubDomainResponse:
    """
    Admin endpoint: Updates an existing sub-domain.
    """
    sub_domain = db.query(SubDomain).filter(SubDomain.id == sub_domain_id).first()
    if not sub_domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sub-domain not found",
        )

    if sub_domain_update.domain_id is not None:
        parent = db.query(Domain).filter(Domain.id == sub_domain_update.domain_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target parent domain does not exist",
            )
        sub_domain.domain_id = sub_domain_update.domain_id

    if sub_domain_update.slug is not None:
        conflict = (
            db.query(SubDomain)
            .filter(SubDomain.slug == sub_domain_update.slug, SubDomain.id != sub_domain_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sub-domain with slug '{sub_domain_update.slug}' already exists",
            )
        sub_domain.slug = sub_domain_update.slug

    if sub_domain_update.name is not None:
        sub_domain.name = sub_domain_update.name
    if sub_domain_update.description is not None:
        sub_domain.description = sub_domain_update.description

    db.commit()
    db.refresh(sub_domain)
    return sub_domain


@router.delete(
    "/{sub_domain_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete sub-domain (Admin only)",
)
def delete_sub_domain(
    sub_domain_id: uuid.UUID,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Admin endpoint: Deletes a sub-domain. Enforces RESTRICT constraint:
    cannot delete sub-domain if courses reference it.
    """
    sub_domain = db.query(SubDomain).filter(SubDomain.id == sub_domain_id).first()
    if not sub_domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sub-domain not found",
        )

    course_count = db.query(Course).filter(Course.sub_domain_id == sub_domain_id).count()
    if course_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete sub-domain '{sub_domain.name}': referenced by {course_count} courses. Move or delete courses first.",
        )

    try:
        db.delete(sub_domain)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete sub-domain due to existing database references",
        )

    return MessageResponse(message=f"Sub-domain '{sub_domain.name}' deleted successfully")
