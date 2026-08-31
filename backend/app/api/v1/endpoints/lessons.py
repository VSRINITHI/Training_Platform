import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.dependencies import get_db, require_role
from app.models.user import User
from app.models.course import Course, Module, Lesson
from app.models.enums import UserRole
from app.schemas.course import (
    LessonCreate,
    LessonUpdate,
    LessonResponse,
    ReorderRequest,
)
from app.schemas.common import MessageResponse

router = APIRouter(tags=["Lessons (Curriculum)"])


def _check_module_course_ownership(module: Module, current_user: User, db: Session) -> Course:
    course = db.query(Course).filter(Course.id == module.course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent course not found",
        )
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this lesson",
        )
    return course


@router.get(
    "/modules/{module_id}/lessons",
    response_model=List[LessonResponse],
    status_code=status.HTTP_200_OK,
    summary="List ordered lessons of a module",
)
def list_module_lessons(
    module_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> List[LessonResponse]:
    """
    Retrieves all lessons in a module ordered by order_index.
    """
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found",
        )

    lessons = (
        db.query(Lesson)
        .filter(Lesson.module_id == module_id)
        .order_by(Lesson.order_index.asc())
        .all()
    )
    return lessons


@router.get(
    "/lessons/{lesson_id}",
    response_model=LessonResponse,
    status_code=status.HTTP_200_OK,
    summary="Get lesson details",
)
def get_lesson(
    lesson_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> LessonResponse:
    """
    Retrieves a single lesson's full content (text body, video URL, document URL).
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found",
        )
    return lesson


@router.post(
    "/modules/{module_id}/lessons",
    response_model=LessonResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create lesson in module (Owner Instructor / Admin)",
)
def create_lesson(
    module_id: uuid.UUID,
    lesson_in: LessonCreate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> LessonResponse:
    """
    Creates a new lesson inside a module chapter.
    Preserves flexible content model: any combination of content_body, video_url, document_url is valid.
    """
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found",
        )

    _check_module_course_ownership(module, current_user, db)

    # Determine order index
    order_index = lesson_in.order_index
    if order_index is None:
        max_order = (
            db.query(func.max(Lesson.order_index))
            .filter(Lesson.module_id == module_id)
            .scalar()
        )
        order_index = (max_order or 0) + 1
    else:
        existing = (
            db.query(Lesson)
            .filter(Lesson.module_id == module_id, Lesson.order_index == order_index)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lesson with order_index {order_index} already exists in this module",
            )

    lesson = Lesson(
        module_id=module_id,
        title=lesson_in.title,
        content_body=lesson_in.content_body,
        video_url=lesson_in.video_url,
        document_url=lesson_in.document_url,
        duration_minutes=lesson_in.duration_minutes,
        order_index=order_index,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


@router.patch(
    "/lessons/{lesson_id}",
    response_model=LessonResponse,
    status_code=status.HTTP_200_OK,
    summary="Update lesson (Owner Instructor / Admin)",
)
def update_lesson(
    lesson_id: uuid.UUID,
    lesson_update: LessonUpdate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> LessonResponse:
    """
    Updates lesson content and ordering.
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found",
        )

    module = db.query(Module).filter(Module.id == lesson.module_id).first()
    _check_module_course_ownership(module, current_user, db)

    if lesson_update.order_index is not None and lesson_update.order_index != lesson.order_index:
        conflict = (
            db.query(Lesson)
            .filter(
                Lesson.module_id == lesson.module_id,
                Lesson.order_index == lesson_update.order_index,
                Lesson.id != lesson_id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lesson with order_index {lesson_update.order_index} already exists in this module",
            )
        lesson.order_index = lesson_update.order_index

    if lesson_update.title is not None:
        lesson.title = lesson_update.title
    if lesson_update.content_body is not None:
        lesson.content_body = lesson_update.content_body
    if lesson_update.video_url is not None:
        lesson.video_url = lesson_update.video_url
    if lesson_update.document_url is not None:
        lesson.document_url = lesson_update.document_url
    if lesson_update.duration_minutes is not None:
        lesson.duration_minutes = lesson_update.duration_minutes

    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete(
    "/lessons/{lesson_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete lesson (Owner Instructor / Admin)",
)
def delete_lesson(
    lesson_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Deletes a lesson.
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found",
        )

    module = db.query(Module).filter(Module.id == lesson.module_id).first()
    _check_module_course_ownership(module, current_user, db)

    db.delete(lesson)
    db.commit()
    return MessageResponse(message=f"Lesson '{lesson.title}' deleted successfully")


@router.post(
    "/modules/{module_id}/lessons/reorder",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Reorder lessons within a module",
)
def reorder_lessons(
    module_id: uuid.UUID,
    reorder_in: ReorderRequest,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Atomically reorders lessons within a module.
    """
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found",
        )
    # Two-pass update with large positive offset to prevent UNIQUE constraint collisions
    # Step 1: Shift to temporary offset indices
    for i, item in enumerate(reorder_in.items):
        db.query(Lesson).filter(
            Lesson.id == item.id,
            Lesson.module_id == module_id,
        ).update({"order_index": 100000 + i})
    db.flush()

    # Step 2: Assign final target indices
    for item in reorder_in.items:
        db.query(Lesson).filter(
            Lesson.id == item.id,
            Lesson.module_id == module_id,
        ).update({"order_index": item.order_index})

    db.commit()
    return MessageResponse(message="Lessons reordered successfully")
