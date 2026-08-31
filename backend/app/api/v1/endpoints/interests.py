import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.core.dependencies import get_db, get_current_user
from app.models.user import User, UserInterest
from app.models.taxonomy import SubDomain
from app.schemas.user import UserInterestResponse, UserInterestsUpdate
from app.schemas.taxonomy import UserInterestDetailResponse
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/interests", tags=["User Interests (Personalization)"])


@router.get(
    "/me",
    response_model=List[UserInterestDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="Get current user interests (Authenticated)",
)
def get_my_interests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[UserInterestDetailResponse]:
    """
    Returns the list of sub-domain interests selected by the current learner.
    Parent domain is derived via sub_domains.domain_id.
    """
    interests = (
        db.query(UserInterest)
        .options(
            joinedload(UserInterest.sub_domain).joinedload(SubDomain.domain)
        )
        .filter(UserInterest.user_id == current_user.id)
        .order_by(UserInterest.created_at.desc())
        .all()
    )
    return interests


@router.put(
    "/me",
    response_model=List[UserInterestDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="Set or update current user interests (Authenticated)",
)
def set_my_interests(
    interests_update: UserInterestsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[UserInterestDetailResponse]:
    """
    Atomically updates the current learner's selected sub-domain interests.
    Validates all sub-domain IDs before persisting.
    """
    requested_ids = set(interests_update.sub_domain_ids)

    # Validate that all requested sub-domains exist
    if requested_ids:
        existing_count = (
            db.query(SubDomain)
            .filter(SubDomain.id.in_(requested_ids))
            .count()
        )
        if existing_count != len(requested_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more specified sub-domain IDs do not exist",
            )

    # Delete existing interests for this user
    db.query(UserInterest).filter(UserInterest.user_id == current_user.id).delete()

    # Insert new interests
    for sub_id in requested_ids:
        interest = UserInterest(user_id=current_user.id, sub_domain_id=sub_id)
        db.add(interest)

    db.commit()

    # Return refreshed list with relationships
    updated_interests = (
        db.query(UserInterest)
        .options(
            joinedload(UserInterest.sub_domain).joinedload(SubDomain.domain)
        )
        .filter(UserInterest.user_id == current_user.id)
        .all()
    )
    return updated_interests


@router.delete(
    "/me/{sub_domain_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove a specific sub-domain interest (Authenticated)",
)
def remove_interest(
    sub_domain_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Removes a single sub-domain from the current user's interest list.
    """
    interest = (
        db.query(UserInterest)
        .filter(
            UserInterest.user_id == current_user.id,
            UserInterest.sub_domain_id == sub_domain_id,
        )
        .first()
    )
    if not interest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interest not found for this user",
        )

    db.delete(interest)
    db.commit()
    return MessageResponse(message="Interest removed successfully")
