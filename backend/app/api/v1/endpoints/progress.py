import uuid
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload, joinedload
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.course import Course, Module, Lesson
from app.models.quiz import Quiz
from app.models.enrollment import Enrollment, ModuleProgress, LessonProgress
from app.models.enums import EnrollmentStatus, ModuleProgressStatus, QuizType
from app.schemas.enrollment import (
    LessonProgressUpdate,
    LessonProgressResponse,
    ModuleProgressResponse,
    ModuleProgressDetailResponse,
    CourseProgressResponse,
)
from app.schemas.common import MessageResponse

router = APIRouter(tags=["Progress & Learning Lifecycle"])


def _check_module_unlocked(module: Module, all_course_modules: List[Module], user_id: uuid.UUID, db: Session) -> bool:
    """
    Sequential Module Unlock Rule:
    - Module 1 (order_index=1 or lowest order) is always unlocked.
    - Module N is unlocked if all previous required modules (order_index < N, is_required=True)
      have status == COMPLETED in the user's active enrollment.
    - Zero cached columns used.
    """
    sorted_modules = sorted(all_course_modules, key=lambda m: m.order_index)
    
    # Check all preceding required modules
    for prev_mod in sorted_modules:
        if prev_mod.order_index >= module.order_index:
            break
        if prev_mod.is_required:
            prog = (
                db.query(ModuleProgress)
                .join(Enrollment)
                .filter(
                    Enrollment.user_id == user_id,
                    Enrollment.course_id == module.course_id,
                    Enrollment.status == EnrollmentStatus.ACTIVE,
                    ModuleProgress.module_id == prev_mod.id,
                )
                .first()
            )
            if not prog or prog.status != ModuleProgressStatus.COMPLETED:
                return False

    return True


@router.post(
    "/lessons/{lesson_id}/progress",
    response_model=LessonProgressResponse,
    status_code=status.HTTP_200_OK,
    summary="Update lesson progress (Mark completed)",
)
def update_lesson_progress(
    lesson_id: uuid.UUID,
    progress_in: LessonProgressUpdate = LessonProgressUpdate(is_completed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LessonProgressResponse:
    """
    Marks a lesson as completed (or in-progress) for the active enrollment.
    - Enforces sequential module unlock rules: Learner cannot complete lessons in a locked module.
    - Auto-transitions module status to IN_PROGRESS when starting.
    - If all lessons in the module are finished and no module quiz exists, auto-completes module.
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    module = db.query(Module).filter(Module.id == lesson.module_id).first()
    course = db.query(Course).filter(Course.id == module.course_id).first()

    # Find active enrollment
    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course.id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be actively enrolled in the course to track lesson progress",
        )

    # Check sequential module unlock
    all_modules = db.query(Module).filter(Module.course_id == course.id).all()
    if not _check_module_unlocked(module, all_modules, current_user.id, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Previous required modules must be completed before accessing lessons in this module",
        )

    # Find or create ModuleProgress
    mod_prog = (
        db.query(ModuleProgress)
        .filter(
            ModuleProgress.enrollment_id == enrollment.id,
            ModuleProgress.module_id == module.id,
        )
        .first()
    )
    if not mod_prog:
        mod_prog = ModuleProgress(
            enrollment_id=enrollment.id,
            module_id=module.id,
            status=ModuleProgressStatus.IN_PROGRESS,
            started_at=datetime.now(timezone.utc),
        )
        db.add(mod_prog)
        db.flush()
    elif mod_prog.status == ModuleProgressStatus.NOT_STARTED:
        mod_prog.status = ModuleProgressStatus.IN_PROGRESS
        mod_prog.started_at = datetime.now(timezone.utc)

    # Find or create LessonProgress
    les_prog = (
        db.query(LessonProgress)
        .filter(
            LessonProgress.module_progress_id == mod_prog.id,
            LessonProgress.lesson_id == lesson_id,
        )
        .first()
    )
    if not les_prog:
        les_prog = LessonProgress(
            module_progress_id=mod_prog.id,
            lesson_id=lesson_id,
            is_completed=progress_in.is_completed,
            completed_at=datetime.now(timezone.utc) if progress_in.is_completed else None,
        )
        db.add(les_prog)
    else:
        les_prog.is_completed = progress_in.is_completed
        les_prog.completed_at = datetime.now(timezone.utc) if progress_in.is_completed else None

    db.flush()

    # Check if all lessons in this module are now completed
    module_lessons = db.query(Lesson).filter(Lesson.module_id == module.id).all()
    completed_lessons_count = (
        db.query(LessonProgress)
        .filter(
            LessonProgress.module_progress_id == mod_prog.id,
            LessonProgress.is_completed == True,
        )
        .count()
    )

    if len(module_lessons) > 0 and completed_lessons_count == len(module_lessons):
        # Check if this module has a module-level quiz
        module_quiz = db.query(Quiz).filter(Quiz.module_id == module.id, Quiz.quiz_type == QuizType.MODULE).first()
        if not module_quiz:
            # No module quiz: Module is now COMPLETED
            mod_prog.status = ModuleProgressStatus.COMPLETED
            mod_prog.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(les_prog)
    return les_prog


@router.get(
    "/courses/{course_id}/progress",
    response_model=CourseProgressResponse,
    status_code=status.HTTP_200_OK,
    summary="Get complete course progress hierarchy (Dynamic)",
)
def get_course_progress(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CourseProgressResponse:
    """
    Computes complete real-time course progress:
    - Dynamic course completion percentage (0.00% - 100.00%)
    - Dynamic module unlock status
    - Dynamic final exam unlock status
    - Lesson progress records per module
    """
    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active enrollment not found for this course",
        )

    all_modules = (
        db.query(Module)
        .options(selectinload(Module.lessons))
        .filter(Module.course_id == course_id)
        .order_by(Module.order_index.asc())
        .all()
    )

    required_modules = [m for m in all_modules if m.is_required]
    if not required_modules:
        required_modules = all_modules

    module_details = []
    completed_required_count = 0

    for mod in all_modules:
        mod_prog = (
            db.query(ModuleProgress)
            .options(selectinload(ModuleProgress.lesson_progress_records))
            .filter(
                ModuleProgress.enrollment_id == enrollment.id,
                ModuleProgress.module_id == mod.id,
            )
            .first()
        )

        is_unlocked = _check_module_unlocked(mod, all_modules, current_user.id, db)
        
        status_val = mod_prog.status if mod_prog else ModuleProgressStatus.NOT_STARTED
        attempts_used = mod_prog.attempts_used if mod_prog else 0
        started_at = mod_prog.started_at if mod_prog else None
        completed_at = mod_prog.completed_at if mod_prog else None
        relearning_triggered_at = mod_prog.relearning_triggered_at if mod_prog else None
        lesson_records = mod_prog.lesson_progress_records if mod_prog else []
        prog_id = mod_prog.id if mod_prog else uuid.uuid4()

        total_lessons = len(mod.lessons)
        completed_lessons = sum(1 for lp in lesson_records if lp.is_completed)

        # Look up active module quiz
        module_quiz = (
            db.query(Quiz)
            .filter(Quiz.module_id == mod.id, Quiz.quiz_type == QuizType.MODULE, Quiz.is_active == True)
            .first()
        )
        quiz_id = module_quiz.id if module_quiz else None
        quiz_title = module_quiz.title if module_quiz else None
        quiz_passing_score = module_quiz.passing_score if module_quiz else None
        quiz_attempts_remaining = max(0, 2 - attempts_used)
        is_quiz_passed = (status_val == ModuleProgressStatus.COMPLETED)

        if mod.is_required and status_val == ModuleProgressStatus.COMPLETED:
            completed_required_count += 1

        detail = ModuleProgressDetailResponse(
            id=prog_id,
            enrollment_id=enrollment.id,
            module_id=mod.id,
            module_title=mod.title,
            order_index=mod.order_index,
            is_required=mod.is_required,
            is_unlocked=is_unlocked,
            status=status_val,
            attempts_used=attempts_used,
            started_at=started_at,
            completed_at=completed_at,
            relearning_triggered_at=relearning_triggered_at,
            total_lessons_count=total_lessons,
            completed_lessons_count=completed_lessons,
            quiz_id=quiz_id,
            quiz_title=quiz_title,
            quiz_passing_score=quiz_passing_score,
            quiz_attempts_remaining=quiz_attempts_remaining,
            is_quiz_passed=is_quiz_passed,
            lesson_progress_records=[
                LessonProgressResponse(
                    id=lp.id,
                    module_progress_id=lp.module_progress_id,
                    lesson_id=lp.lesson_id,
                    is_completed=lp.is_completed,
                    completed_at=lp.completed_at,
                )
                for lp in lesson_records
            ],
        )
        module_details.append(detail)

    # Calculate overall progress percentage based on completed lessons
    total_req = len(required_modules)
    total_lessons_in_course = sum(len(m.lessons) for m in all_modules)
    total_completed_lessons_in_course = sum(
        d.completed_lessons_count for d in module_details
    )

    if enrollment.status == EnrollmentStatus.COMPLETED:
        progress_pct = Decimal("100.00")
    elif total_lessons_in_course > 0:
        progress_pct = (
            (Decimal(total_completed_lessons_in_course) / Decimal(total_lessons_in_course) * Decimal("100.00")).quantize(Decimal("0.01"))
        )
    else:
        progress_pct = Decimal("0.00")

    # Final exam unlock rule: ALL required modules must be completed (lessons finished + checkpoint quiz passed)
    is_final_unlocked = (completed_required_count == total_req and total_req > 0)
    is_course_completed = (enrollment.status == EnrollmentStatus.COMPLETED)

    # Look up active course final exam
    final_quiz = (
        db.query(Quiz)
        .filter(Quiz.course_id == course_id, Quiz.quiz_type == QuizType.FINAL, Quiz.is_active == True)
        .first()
    )
    final_exam_quiz_id = final_quiz.id if final_quiz else None

    return CourseProgressResponse(
        enrollment_id=enrollment.id,
        course_id=course_id,
        status=enrollment.status,
        total_required_modules=total_req,
        completed_required_modules=completed_required_count,
        progress_pct=progress_pct,
        is_final_exam_unlocked=is_final_unlocked,
        is_course_completed=is_course_completed,
        final_exam_quiz_id=final_exam_quiz_id,
        modules=module_details,
    )


@router.post(
    "/modules/{module_id}/relearning/reset",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset module in relearning status to re-study lessons",
)
def reset_module_relearning(
    module_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Relearning Lifecycle execution:
    When a module is in NEEDS_RELEARNING, resets lesson progress to False and module status
    to IN_PROGRESS so the learner can review the material.
    """
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == module.course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Active enrollment not found")

    mod_prog = (
        db.query(ModuleProgress)
        .filter(
            ModuleProgress.enrollment_id == enrollment.id,
            ModuleProgress.module_id == module_id,
        )
        .first()
    )
    if not mod_prog:
        raise HTTPException(status_code=404, detail="Module progress record not found")

    if mod_prog.status != ModuleProgressStatus.NEEDS_RELEARNING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Module is not in relearning status (current status: {mod_prog.status.value})",
        )

    # Reset module progress status to IN_PROGRESS and attempts_used to 0
    mod_prog.status = ModuleProgressStatus.IN_PROGRESS
    mod_prog.attempts_used = 0
    mod_prog.started_at = datetime.now(timezone.utc)
    mod_prog.completed_at = None

    # Reset all lesson progress in this module
    db.query(LessonProgress).filter(
        LessonProgress.module_progress_id == mod_prog.id
    ).update({"is_completed": False, "completed_at": None})

    db.commit()
    return MessageResponse(message="Module reset to in-progress for relearning. Lessons are ready for review.")
