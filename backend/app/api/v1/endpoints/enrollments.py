import uuid
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload
from app.core.dependencies import get_db, get_current_user, require_role
from app.models.user import User
from app.models.course import Course, Module, Lesson
from app.models.enrollment import Enrollment, ModuleProgress, LessonProgress
from app.models.enums import UserRole, EnrollmentStatus, ModuleProgressStatus
from app.schemas.enrollment import (
    EnrollmentCreate,
    EnrollmentResponse,
    EnrollmentDetailResponse,
)
from app.schemas.course import CourseResponse
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/enrollments", tags=["Enrollments"])


def calculate_enrollment_progress(enrollment: Enrollment, db: Session) -> Decimal:
    """
    Computes dynamic course progress percentage from module_progress at runtime.
    Formula: (COUNT(completed required modules) / COUNT(total required modules)) * 100.
    Zero cached columns used.
    """
    modules = db.query(Module).filter(Module.course_id == enrollment.course_id).all()
    required_modules = [m for m in modules if m.is_required]
    
    if not required_modules:
        # If no modules are explicitly marked required, use all modules
        required_modules = modules
        
    if not required_modules:
        return Decimal("0.00")

    required_module_ids = {m.id for m in required_modules}
    completed_count = (
        db.query(ModuleProgress)
        .filter(
            ModuleProgress.enrollment_id == enrollment.id,
            ModuleProgress.module_id.in_(required_module_ids),
            ModuleProgress.status == ModuleProgressStatus.COMPLETED,
        )
        .count()
    )

    pct = (Decimal(completed_count) / Decimal(len(required_modules))) * Decimal("100.00")
    return pct.quantize(Decimal("0.01"))


@router.post(
    "",
    response_model=EnrollmentDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enroll current user in a course",
)
def enroll_course(
    enrollment_in: EnrollmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EnrollmentDetailResponse:
    """
    Enrolls the learner in a published course.
    - Automatically initializes module_progress for all course modules.
    - Automatically initializes lesson_progress for all lessons in each module.
    """
    course = (
        db.query(Course)
        .options(selectinload(Course.modules).selectinload(Module.lessons))
        .filter(Course.id == enrollment_in.course_id)
        .first()
    )
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    if not course.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot enroll in an unpublished course",
        )

    existing = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == enrollment_in.course_id,
        )
        .first()
    )

    if existing:
        if existing.status == EnrollmentStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already actively enrolled in this course",
            )
        elif existing.status == EnrollmentStatus.DROPPED:
            # Reactivate dropped enrollment
            existing.status = EnrollmentStatus.ACTIVE
            existing.enrolled_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing)
            return EnrollmentDetailResponse(
                id=existing.id,
                user_id=existing.user_id,
                course_id=existing.course_id,
                status=existing.status,
                enrolled_at=existing.enrolled_at,
                completed_at=existing.completed_at,
                course=CourseResponse.model_validate(course),
                progress_pct=calculate_enrollment_progress(existing, db),
            )

    enrollment = Enrollment(
        user_id=current_user.id,
        course_id=course.id,
        status=EnrollmentStatus.ACTIVE,
    )
    db.add(enrollment)
    db.flush()

    # Initialize ModuleProgress and LessonProgress for curriculum
    for mod in course.modules:
        mod_prog = ModuleProgress(
            enrollment_id=enrollment.id,
            module_id=mod.id,
            status=ModuleProgressStatus.NOT_STARTED,
            attempts_used=0,
        )
        db.add(mod_prog)
        db.flush()

        for les in mod.lessons:
            les_prog = LessonProgress(
                module_progress_id=mod_prog.id,
                lesson_id=les.id,
                is_completed=False,
            )
            db.add(les_prog)

    db.commit()
    db.refresh(enrollment)

    return EnrollmentDetailResponse(
        id=enrollment.id,
        user_id=enrollment.user_id,
        course_id=enrollment.course_id,
        status=enrollment.status,
        enrolled_at=enrollment.enrolled_at,
        completed_at=enrollment.completed_at,
        course=CourseResponse.model_validate(course),
        progress_pct=Decimal("0.00"),
    )


@router.get(
    "/me",
    response_model=List[EnrollmentDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="List current user's enrollments with dynamic progress",
)
def list_my_enrollments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[EnrollmentDetailResponse]:
    """
    Returns all course enrollments for the logged-in learner with dynamically calculated progress.
    """
    enrollments = (
        db.query(Enrollment)
        .options(joinedload(Enrollment.course))
        .filter(Enrollment.user_id == current_user.id)
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )

    results = []
    for enr in enrollments:
        pct = calculate_enrollment_progress(enr, db)
        results.append(
            EnrollmentDetailResponse(
                id=enr.id,
                user_id=enr.user_id,
                course_id=enr.course_id,
                status=enr.status,
                enrolled_at=enr.enrolled_at,
                completed_at=enr.completed_at,
                course=CourseResponse.model_validate(enr.course) if enr.course else None,
                progress_pct=pct,
            )
        )
    return results


@router.get(
    "/{enrollment_id}",
    response_model=EnrollmentDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single enrollment details",
)
def get_enrollment(
    enrollment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EnrollmentDetailResponse:
    enrollment = (
        db.query(Enrollment)
        .options(joinedload(Enrollment.course))
        .filter(Enrollment.id == enrollment_id)
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if current_user.role != UserRole.ADMIN and enrollment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this enrollment")

    pct = calculate_enrollment_progress(enrollment, db)
    return EnrollmentDetailResponse(
        id=enrollment.id,
        user_id=enrollment.user_id,
        course_id=enrollment.course_id,
        status=enrollment.status,
        enrolled_at=enrollment.enrolled_at,
        completed_at=enrollment.completed_at,
        course=CourseResponse.model_validate(enrollment.course) if enrollment.course else None,
        progress_pct=pct,
    )


@router.post(
    "/{enrollment_id}/drop",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Drop/cancel a course enrollment",
)
def drop_enrollment(
    enrollment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if current_user.role != UserRole.ADMIN and enrollment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to drop this enrollment")

    enrollment.status = EnrollmentStatus.DROPPED
    db.commit()
    return MessageResponse(message="Enrollment successfully dropped")
