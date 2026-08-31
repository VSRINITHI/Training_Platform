import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.exc import IntegrityError
from app.core.dependencies import get_db, get_current_user, require_role
from app.core.security import decode_token
from app.models.user import User
from app.models.taxonomy import SubDomain
from app.models.course import Course, Module, Lesson
from app.models.enums import UserRole, DifficultyLevel
from app.schemas.course import (
    CourseCreate,
    CourseUpdate,
    CourseResponse,
    CourseDetailResponse,
    CoursePublishResponse,
)
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/courses", tags=["Courses (Curriculum)"])


@router.get(
    "",
    response_model=List[CourseResponse],
    status_code=status.HTTP_200_OK,
    summary="List courses (Public / Author catalog)",
)
def list_courses(
    sub_domain_id: Optional[uuid.UUID] = Query(None, description="Filter by Sub-Domain"),
    difficulty: Optional[DifficultyLevel] = Query(None, description="Filter by difficulty"),
    search: Optional[str] = Query(None, description="Search title/description"),
    my_authored: bool = Query(False, description="Filter to current instructor's courses (Auth required)"),
    authorization: Optional[str] = Header(None, description="Optional Bearer token"),
    db: Session = Depends(get_db),
) -> List[CourseResponse]:
    """
    Lists courses.
    - If my_authored=True (and authenticated as instructor/admin), returns all authored courses (including drafts).
    - Otherwise, returns published courses matching the specified filters.
    """
    current_user: Optional[User] = None
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split("Bearer ")[1].strip()
            payload = decode_token(token)
            user_id = uuid.UUID(payload.get("sub"))
            current_user = db.query(User).filter(User.id == user_id).first()
        except Exception:
            pass

    query = db.query(Course).options(
        joinedload(Course.instructor),
        joinedload(Course.sub_domain),
    )

    if my_authored:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to view authored courses",
            )
        if current_user.role not in [UserRole.INSTRUCTOR, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only instructors and administrators have authored courses",
            )
        if current_user.role == UserRole.INSTRUCTOR:
            query = query.filter(Course.instructor_id == current_user.id)
    else:
        # Default public view: published courses only
        query = query.filter(Course.is_published == True)

    if sub_domain_id:
        query = query.filter(Course.sub_domain_id == sub_domain_id)
    if difficulty:
        query = query.filter(Course.difficulty_level == difficulty)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter((Course.title.ilike(term)) | (Course.description.ilike(term)))

    courses = query.order_by(Course.created_at.desc()).all()
    return courses


@router.get(
    "/{course_identifier}",
    response_model=CourseDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get course curriculum detail by ID or slug",
)
def get_course_detail(
    course_identifier: str,
    authorization: Optional[str] = Header(None, description="Optional Bearer token"),
    db: Session = Depends(get_db),
) -> CourseDetailResponse:
    """
    Retrieves complete course curriculum: metadata, instructor, sub-domain,
    ordered modules, and ordered lessons.
    Unpublished courses are only accessible to the authoring instructor or an admin.
    """
    current_user: Optional[User] = None
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split("Bearer ")[1].strip()
            payload = decode_token(token)
            user_id = uuid.UUID(payload.get("sub"))
            current_user = db.query(User).filter(User.id == user_id).first()
        except Exception:
            pass

    query = db.query(Course).options(
        joinedload(Course.instructor),
        joinedload(Course.sub_domain),
        selectinload(Course.modules).selectinload(Module.lessons),
    )

    try:
        c_id = uuid.UUID(course_identifier)
        course = query.filter(Course.id == c_id).first()
    except ValueError:
        course = query.filter(Course.slug == course_identifier).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_identifier}' not found",
        )

    # Permission check for draft/unpublished courses
    if not course.is_published:
        is_admin = current_user and current_user.role == UserRole.ADMIN
        is_owner = current_user and current_user.id == course.instructor_id
        if not (is_admin or is_owner):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course is currently in draft mode and not published",
            )

    return course


@router.post(
    "",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create course (Instructor / Admin)",
)
def create_course(
    course_in: CourseCreate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> CourseResponse:
    """
    Creates a new course draft.
    - Default instructor is the current user.
    - Admins may optionally designate another instructor ID.
    """
    sub_domain = db.query(SubDomain).filter(SubDomain.id == course_in.sub_domain_id).first()
    if not sub_domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sub-domain '{course_in.sub_domain_id}' does not exist",
        )

    existing_slug = db.query(Course).filter(Course.slug == course_in.slug).first()
    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Course with slug '{course_in.slug}' already exists",
        )

    instructor_id = current_user.id
    if current_user.role == UserRole.ADMIN and course_in.instructor_id:
        # Validate designated instructor
        inst = db.query(User).filter(User.id == course_in.instructor_id).first()
        if not inst:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Designated instructor user does not exist",
            )
        instructor_id = course_in.instructor_id

    course = Course(
        instructor_id=instructor_id,
        sub_domain_id=course_in.sub_domain_id,
        title=course_in.title,
        slug=course_in.slug,
        description=course_in.description,
        thumbnail_url=course_in.thumbnail_url,
        difficulty_level=course_in.difficulty_level,
        is_published=False,  # Always created as draft
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.patch(
    "/{course_id}",
    response_model=CourseResponse,
    status_code=status.HTTP_200_OK,
    summary="Update course (Owner Instructor / Admin)",
)
def update_course(
    course_id: uuid.UUID,
    course_update: CourseUpdate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> CourseResponse:
    """
    Updates course metadata. Enforces ownership: only the authoring instructor or an admin can edit.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this course",
        )

    if course_update.slug is not None and course_update.slug != course.slug:
        conflict = (
            db.query(Course)
            .filter(Course.slug == course_update.slug, Course.id != course_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Course with slug '{course_update.slug}' already exists",
            )
        course.slug = course_update.slug

    if course_update.sub_domain_id is not None:
        sub = db.query(SubDomain).filter(SubDomain.id == course_update.sub_domain_id).first()
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Specified sub-domain does not exist",
            )
        course.sub_domain_id = course_update.sub_domain_id

    if course_update.title is not None:
        course.title = course_update.title
    if course_update.description is not None:
        course.description = course_update.description
    if course_update.thumbnail_url is not None:
        course.thumbnail_url = course_update.thumbnail_url
    if course_update.difficulty_level is not None:
        course.difficulty_level = course_update.difficulty_level
    if course_update.is_published is not None:
        course.is_published = course_update.is_published

    db.commit()
    db.refresh(course)
    return course


@router.delete(
    "/{course_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete course (Owner Instructor / Admin)",
)
def delete_course(
    course_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Deletes a course and its associated curriculum chapters.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this course",
        )

    db.delete(course)
    db.commit()
    return MessageResponse(message=f"Course '{course.title}' deleted successfully")


@router.post(
    "/{course_id}/publish",
    response_model=CoursePublishResponse,
    status_code=status.HTTP_200_OK,
    summary="Publish course (Owner Instructor / Admin)",
)
def publish_course(
    course_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> CoursePublishResponse:
    """
    Publishes a course to make it visible in the learner catalog.
    Validates curriculum completeness: Course must contain at least 1 module,
    and each module must contain at least 1 lesson.
    """
    course = (
        db.query(Course)
        .options(selectinload(Course.modules).selectinload(Module.lessons))
        .filter(Course.id == course_id)
        .first()
    )
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to publish this course",
        )

    if not course.modules:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish course: course must contain at least one module",
        )

    for mod in course.modules:
        if not mod.lessons:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot publish course: module '{mod.title}' contains no lessons",
            )

    course.is_published = True
    db.commit()
    return CoursePublishResponse(
        id=course.id,
        is_published=True,
        message="Course successfully published to catalog",
    )


@router.post(
    "/{course_id}/unpublish",
    response_model=CoursePublishResponse,
    status_code=status.HTTP_200_OK,
    summary="Unpublish course (Owner Instructor / Admin)",
)
def unpublish_course(
    course_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> CoursePublishResponse:
    """
    Unpublishes a course, reverting it to draft mode.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to unpublish this course",
        )

    course.is_published = False
    db.commit()
    return CoursePublishResponse(
        id=course.id,
        is_published=False,
        message="Course unpublished and reverted to draft mode",
    )
