import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from app.core.dependencies import get_db, require_role
from app.models.user import User
from app.models.course import Course, Module, Lesson
from app.models.enums import UserRole
from app.schemas.course import (
    ModuleCreate,
    ModuleUpdate,
    ModuleResponse,
    ModuleDetailResponse,
    ReorderRequest,
)
from app.schemas.common import MessageResponse

router = APIRouter(tags=["Modules (Curriculum)"])


def _check_course_ownership(course: Course, current_user: User) -> None:
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this course curriculum",
        )


@router.get(
    "/courses/{course_id}/modules",
    response_model=List[ModuleDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="List ordered modules of a course",
)
def list_course_modules(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> List[ModuleDetailResponse]:
    """
    Retrieves all modules belonging to a course, ordered by order_index.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    modules = (
        db.query(Module)
        .options(selectinload(Module.lessons))
        .filter(Module.course_id == course_id)
        .order_by(Module.order_index.asc())
        .all()
    )
    return modules


@router.get(
    "/modules/{module_id}",
    response_model=ModuleDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get module details with lessons",
)
def get_module_detail(
    module_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ModuleDetailResponse:
    """
    Retrieves a single module and its ordered lessons.
    """
    module = (
        db.query(Module)
        .options(selectinload(Module.lessons))
        .filter(Module.id == module_id)
        .first()
    )
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found",
        )
    return module


@router.post(
    "/courses/{course_id}/modules",
    response_model=ModuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create module in course (Owner Instructor / Admin)",
)
def create_module(
    course_id: uuid.UUID,
    module_in: ModuleCreate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ModuleResponse:
    """
    Appends a new module chapter to a course. Auto-assigns next order_index if omitted.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    _check_course_ownership(course, current_user)

    # Determine order index
    order_index = module_in.order_index
    if order_index is None:
        max_order = (
            db.query(func.max(Module.order_index))
            .filter(Module.course_id == course_id)
            .scalar()
        )
        order_index = (max_order or 0) + 1
    else:
        # Check uniqueness of order_index in this course
        existing = (
            db.query(Module)
            .filter(Module.course_id == course_id, Module.order_index == order_index)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Module with order_index {order_index} already exists in this course",
            )

    module = Module(
        course_id=course_id,
        title=module_in.title,
        description=module_in.description,
        order_index=order_index,
        is_required=module_in.is_required,
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


@router.patch(
    "/modules/{module_id}",
    response_model=ModuleResponse,
    status_code=status.HTTP_200_OK,
    summary="Update module (Owner Instructor / Admin)",
)
def update_module(
    module_id: uuid.UUID,
    module_update: ModuleUpdate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ModuleResponse:
    """
    Updates module metadata.
    """
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found",
        )

    course = db.query(Course).filter(Course.id == module.course_id).first()
    _check_course_ownership(course, current_user)

    if module_update.order_index is not None and module_update.order_index != module.order_index:
        conflict = (
            db.query(Module)
            .filter(
                Module.course_id == module.course_id,
                Module.order_index == module_update.order_index,
                Module.id != module_id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Module with order_index {module_update.order_index} already exists in this course",
            )
        module.order_index = module_update.order_index

    if module_update.title is not None:
        module.title = module_update.title
    if module_update.description is not None:
        module.description = module_update.description
    if module_update.is_required is not None:
        module.is_required = module_update.is_required

    db.commit()
    db.refresh(module)
    return module


@router.delete(
    "/modules/{module_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete module (Owner Instructor / Admin)",
)
def delete_module(
    module_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Deletes a module chapter and its child lessons.
    """
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found",
        )

    course = db.query(Course).filter(Course.id == module.course_id).first()
    _check_course_ownership(course, current_user)

    db.delete(module)
    db.commit()
    return MessageResponse(message=f"Module '{module.title}' deleted successfully")


@router.post(
    "/courses/{course_id}/modules/reorder",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Reorder modules within a course",
)
def reorder_modules(
    course_id: uuid.UUID,
    reorder_in: ReorderRequest,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Atomically reorders modules within a course.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )
    _check_course_ownership(course, current_user)

    # Two-pass update with large positive offset to prevent UNIQUE constraint collisions
    # Step 1: Shift to temporary offset indices
    for i, item in enumerate(reorder_in.items):
        db.query(Module).filter(
            Module.id == item.id,
            Module.course_id == course_id,
        ).update({"order_index": 100000 + i})
    db.flush()

    # Step 2: Assign final target indices
    for item in reorder_in.items:
        db.query(Module).filter(
            Module.id == item.id,
            Module.course_id == course_id,
        ).update({"order_index": item.order_index})

    db.commit()
    return MessageResponse(message="Modules reordered successfully")
