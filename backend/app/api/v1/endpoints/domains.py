import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from app.core.dependencies import get_db, require_role
from app.models.user import User
from app.models.taxonomy import Domain, SubDomain
from app.models.enums import UserRole
from app.schemas.taxonomy import (
    DomainCreate,
    DomainUpdate,
    DomainResponse,
    DomainWithSubDomainsResponse,
)
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/domains", tags=["Domains (Taxonomy)"])


@router.get(
    "",
    response_model=List[DomainWithSubDomainsResponse],
    status_code=status.HTTP_200_OK,
    summary="List all domains (Public)",
)
def list_domains(
    db: Session = Depends(get_db),
) -> List[DomainWithSubDomainsResponse]:
    """
    Public endpoint: Retrieves all top-level subject domains with their child sub-domains.
    """
    domains = (
        db.query(Domain)
        .options(joinedload(Domain.sub_domains))
        .order_by(Domain.name.asc())
        .all()
    )
    return domains


@router.get(
    "/{domain_identifier}",
    response_model=DomainWithSubDomainsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get domain by ID or slug (Public)",
)
def get_domain(
    domain_identifier: str,
    db: Session = Depends(get_db),
) -> DomainWithSubDomainsResponse:
    """
    Public endpoint: Retrieves a domain and its sub-domains by UUID or URL slug.
    """
    try:
        domain_id = uuid.UUID(domain_identifier)
        domain = (
            db.query(Domain)
            .options(joinedload(Domain.sub_domains))
            .filter(Domain.id == domain_id)
            .first()
        )
    except ValueError:
        domain = (
            db.query(Domain)
            .options(joinedload(Domain.sub_domains))
            .filter(Domain.slug == domain_identifier)
            .first()
        )

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain '{domain_identifier}' not found",
        )
    return domain


@router.post(
    "",
    response_model=DomainResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create domain (Admin only)",
)
def create_domain(
    domain_in: DomainCreate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> DomainResponse:
    """
    Admin endpoint: Creates a new top-level subject domain.
    """
    existing_name = db.query(Domain).filter(Domain.name.ilike(domain_in.name)).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Domain with name '{domain_in.name}' already exists",
        )

    existing_slug = db.query(Domain).filter(Domain.slug == domain_in.slug).first()
    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Domain with slug '{domain_in.slug}' already exists",
        )

    domain = Domain(
        name=domain_in.name,
        slug=domain_in.slug,
        description=domain_in.description,
        icon_url=domain_in.icon_url,
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)
    return domain


@router.patch(
    "/{domain_id}",
    response_model=DomainResponse,
    status_code=status.HTTP_200_OK,
    summary="Update domain (Admin only)",
)
def update_domain(
    domain_id: uuid.UUID,
    domain_update: DomainUpdate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> DomainResponse:
    """
    Admin endpoint: Updates an existing domain.
    """
    domain = db.query(Domain).filter(Domain.id == domain_id).first()
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found",
        )

    if domain_update.name is not None:
        conflict = (
            db.query(Domain)
            .filter(Domain.name.ilike(domain_update.name), Domain.id != domain_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Domain with name '{domain_update.name}' already exists",
            )
        domain.name = domain_update.name

    if domain_update.slug is not None:
        conflict = (
            db.query(Domain)
            .filter(Domain.slug == domain_update.slug, Domain.id != domain_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Domain with slug '{domain_update.slug}' already exists",
            )
        domain.slug = domain_update.slug

    if domain_update.description is not None:
        domain.description = domain_update.description
    if domain_update.icon_url is not None:
        domain.icon_url = domain_update.icon_url

    db.commit()
    db.refresh(domain)
    return domain


@router.delete(
    "/{domain_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete domain (Admin only)",
)
def delete_domain(
    domain_id: uuid.UUID,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Admin endpoint: Deletes a domain. Enforces RESTRICT constraint:
    cannot delete domain if child sub-domains exist.
    """
    domain = db.query(Domain).filter(Domain.id == domain_id).first()
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found",
        )

    sub_domain_count = (
        db.query(SubDomain).filter(SubDomain.domain_id == domain_id).count()
    )
    if sub_domain_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete domain '{domain.name}': contains {sub_domain_count} child sub-domains. Remove child sub-domains first.",
        )

    try:
        db.delete(domain)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete domain due to database integrity constraints",
        )

    return MessageResponse(message=f"Domain '{domain.name}' deleted successfully")
