import uuid
from typing import List, Optional, Any
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from app.core.dependencies import get_db, get_current_user, require_role
from app.models.user import User
from app.models.course import Course, Module, Lesson
from app.models.quiz import Quiz, Question, QuestionOption, AIQuizDraft
from app.models.enums import UserRole, QuizType, QuestionType, AIDraftStatus
from app.schemas.quiz import (
    QuizCreate,
    QuizUpdate,
    QuizResponse,
    QuizPublicResponse,
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
    QuestionPublicResponse,
    QuestionOptionCreate,
    QuestionOptionUpdate,
    QuestionOptionResponse,
    AIQuizDraftCreate,
    AIQuizDraftUpdate,
    AIQuizDraftReviewRequest,
    AIQuizDraftResponse,
    AIQuizGenerateRequest,
)
from app.schemas.assessment import (
    QuizSubmissionRequest,
    QuizSubmissionResultResponse,
    QuestionResultResponse,
    QuizAttemptResponse,
)
from app.schemas.course import ReorderRequest
from app.schemas.common import MessageResponse
from app.models.enrollment import Enrollment, ModuleProgress, LessonProgress
from app.models.assessment import QuizAttempt, Certificate
from app.models.enums import EnrollmentStatus, ModuleProgressStatus
from app.services.nvidia_service import generate_quiz_questions, extract_text_from_document

router = APIRouter(tags=["Quizzes & Assessments"])


def _get_quiz_course(quiz: Quiz, db: Session) -> Course:
    if quiz.course_id:
        return db.query(Course).filter(Course.id == quiz.course_id).first()
    elif quiz.module_id:
        module = db.query(Module).filter(Module.id == quiz.module_id).first()
        return db.query(Course).filter(Course.id == module.course_id).first() if module else None
    elif quiz.lesson_id:
        lesson = db.query(Lesson).filter(Lesson.id == quiz.lesson_id).first()
        if lesson:
            module = db.query(Module).filter(Module.id == lesson.module_id).first()
            return db.query(Course).filter(Course.id == module.course_id).first() if module else None
    return None


def _check_quiz_ownership(quiz: Quiz, current_user: User, db: Session) -> Course:
    course = _get_quiz_course(quiz, db)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent course hierarchy for quiz not found",
        )
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this quiz",
        )
    return course


# ---------------------------------------------------------------------------
# Quiz CRUD Endpoints
# ---------------------------------------------------------------------------
@router.get(
    "/quizzes/{quiz_id}",
    response_model=QuizPublicResponse,
    status_code=status.HTTP_200_OK,
    summary="Get quiz for learner assessment (Answers masked)",
)
def get_quiz_public(
    quiz_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> QuizPublicResponse:
    """
    Public/Learner endpoint: Returns the quiz and questions for taking an exam.
    CRITICAL SECURITY RULE: Hides is_correct and explanation to prevent answer leakage.
    """
    quiz = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
        .filter(Quiz.id == quiz_id, Quiz.is_active == True)
        .first()
    )
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found or is currently inactive",
        )
    return quiz


@router.get(
    "/quizzes/{quiz_id}/authoring",
    response_model=QuizResponse,
    status_code=status.HTTP_200_OK,
    summary="Get full quiz for instructor authoring (Answers included)",
)
def get_quiz_authoring(
    quiz_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> QuizResponse:
    """
    Authoring endpoint: Returns the complete quiz with all correct answers and explanations.
    Accessible only to the course author or an admin.
    """
    quiz = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
        .filter(Quiz.id == quiz_id)
        .first()
    )
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )

    _check_quiz_ownership(quiz, current_user, db)
    return quiz


@router.post(
    "/quizzes",
    response_model=QuizResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a quiz (Owner Instructor / Admin)",
)
def create_quiz(
    quiz_in: QuizCreate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> QuizResponse:
    """
    Creates a quiz attached to a lesson, module, or course final exam.
    Validates target existence and course authoring permissions.
    """
    # Validate target and determine parent course
    course = None
    if quiz_in.quiz_type == QuizType.LESSON:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lesson-level quizzes are deprecated and not supported. Quizzes must be created at the Module level (Module Quiz) or Course level (Final Course Assessment).",
        )

    elif quiz_in.quiz_type == QuizType.MODULE:
        module = db.query(Module).filter(Module.id == quiz_in.module_id).first()
        if not module:
            raise HTTPException(status_code=400, detail="Target module does not exist")
        course = db.query(Course).filter(Course.id == module.course_id).first()
        existing = db.query(Quiz).filter(Quiz.module_id == quiz_in.module_id, Quiz.quiz_type == QuizType.MODULE).first()
        if existing:
            raise HTTPException(status_code=400, detail="A quiz already exists for this module")

    elif quiz_in.quiz_type == QuizType.FINAL:
        course = db.query(Course).filter(Course.id == quiz_in.course_id).first()
        if not course:
            raise HTTPException(status_code=400, detail="Target course does not exist")
        existing = db.query(Quiz).filter(Quiz.course_id == quiz_in.course_id, Quiz.quiz_type == QuizType.FINAL).first()
        if existing:
            raise HTTPException(status_code=400, detail="A final exam quiz already exists for this course")

    if not course:
        raise HTTPException(status_code=400, detail="Unable to resolve course hierarchy for quiz")

    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to author quizzes for this course")

    quiz = Quiz(
        title=quiz_in.title,
        description=quiz_in.description,
        quiz_type=quiz_in.quiz_type,
        lesson_id=quiz_in.lesson_id,
        module_id=quiz_in.module_id,
        course_id=quiz_in.course_id,
        passing_score=quiz_in.passing_score,
        max_attempts=quiz_in.max_attempts,
        time_limit_minutes=quiz_in.time_limit_minutes,
        is_active=quiz_in.is_active,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


@router.patch(
    "/quizzes/{quiz_id}",
    response_model=QuizResponse,
    status_code=status.HTTP_200_OK,
    summary="Update quiz (Owner Instructor / Admin)",
)
def update_quiz(
    quiz_id: uuid.UUID,
    quiz_update: QuizUpdate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> QuizResponse:
    quiz = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
        .filter(Quiz.id == quiz_id)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    _check_quiz_ownership(quiz, current_user, db)

    if quiz_update.title is not None:
        quiz.title = quiz_update.title
    if quiz_update.description is not None:
        quiz.description = quiz_update.description
    if quiz_update.passing_score is not None:
        quiz.passing_score = quiz_update.passing_score
    if quiz_update.max_attempts is not None:
        quiz.max_attempts = quiz_update.max_attempts
    if quiz_update.time_limit_minutes is not None:
        quiz.time_limit_minutes = quiz_update.time_limit_minutes
    if quiz_update.is_active is not None:
        quiz.is_active = quiz_update.is_active

    db.commit()
    db.refresh(quiz)
    return quiz


@router.delete(
    "/quizzes/{quiz_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete quiz (Owner Instructor / Admin)",
)
def delete_quiz(
    quiz_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    _check_quiz_ownership(quiz, current_user, db)

    try:
        # Delete associated quiz attempts first to maintain relational integrity
        db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id).delete(synchronize_session=False)
        db.delete(quiz)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Failed to delete quiz: {str(e)}",
        )

    return MessageResponse(message=f"Quiz '{quiz.title}' deleted successfully")


# ---------------------------------------------------------------------------
# Questions CRUD
# ---------------------------------------------------------------------------
@router.post(
    "/quizzes/{quiz_id}/questions",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add question to quiz (Owner Instructor / Admin)",
)
def add_question(
    quiz_id: uuid.UUID,
    question_in: QuestionCreate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> QuestionResponse:
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    _check_quiz_ownership(quiz, current_user, db)

    order_index = question_in.order_index
    if order_index is None:
        max_order = db.query(func.max(Question.order_index)).filter(Question.quiz_id == quiz_id).scalar()
        order_index = (max_order or 0) + 1

    question = Question(
        quiz_id=quiz_id,
        question_text=question_in.question_text,
        question_type=question_in.question_type,
        explanation=question_in.explanation,
        points=question_in.points,
        order_index=order_index,
    )
    db.add(question)
    db.flush()

    if question_in.options:
        for i, opt in enumerate(question_in.options):
            opt_order = opt.order_index if opt.order_index is not None else (i + 1)
            option = QuestionOption(
                question_id=question.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                order_index=opt_order,
            )
            db.add(option)

    db.commit()
    return (
        db.query(Question)
        .options(selectinload(Question.options))
        .filter(Question.id == question.id)
        .first()
    )


@router.patch(
    "/quizzes/questions/{question_id}",
    response_model=QuestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Update question (Owner Instructor / Admin)",
)
def update_question(
    question_id: uuid.UUID,
    question_update: QuestionUpdate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> QuestionResponse:
    question = (
        db.query(Question)
        .options(selectinload(Question.options), joinedload(Question.quiz))
        .filter(Question.id == question_id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    _check_quiz_ownership(question.quiz, current_user, db)

    if question_update.question_text is not None:
        question.question_text = question_update.question_text
    if question_update.question_type is not None:
        question.question_type = question_update.question_type
    if question_update.explanation is not None:
        question.explanation = question_update.explanation
    if question_update.points is not None:
        question.points = question_update.points
    if question_update.order_index is not None and question_update.order_index != question.order_index:
        conflict = (
            db.query(Question)
            .filter(Question.quiz_id == question.quiz_id, Question.order_index == question_update.order_index, Question.id != question_id)
            .first()
        )
        if conflict:
            raise HTTPException(status_code=400, detail=f"Question with order_index {question_update.order_index} already exists")
        question.order_index = question_update.order_index

    db.commit()
    db.refresh(question)
    return question


@router.delete(
    "/quizzes/questions/{question_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete question (Owner Instructor / Admin)",
)
def delete_question(
    question_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    question = db.query(Question).options(joinedload(Question.quiz)).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    _check_quiz_ownership(question.quiz, current_user, db)

    db.delete(question)
    db.commit()
    return MessageResponse(message="Question deleted successfully")


@router.post(
    "/quizzes/{quiz_id}/questions/reorder",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Reorder questions in quiz",
)
def reorder_questions(
    quiz_id: uuid.UUID,
    reorder_in: ReorderRequest,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    _check_quiz_ownership(quiz, current_user, db)

    for i, item in enumerate(reorder_in.items):
        db.query(Question).filter(Question.id == item.id, Question.quiz_id == quiz_id).update({"order_index": 100000 + i})
    db.flush()

    for item in reorder_in.items:
        db.query(Question).filter(Question.id == item.id, Question.quiz_id == quiz_id).update({"order_index": item.order_index})

    db.commit()
    return MessageResponse(message="Questions reordered successfully")


# ---------------------------------------------------------------------------
# Question Options CRUD
# ---------------------------------------------------------------------------
@router.post(
    "/quizzes/questions/{question_id}/options",
    response_model=QuestionOptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add option to question (Owner Instructor / Admin)",
)
def add_question_option(
    question_id: uuid.UUID,
    option_in: QuestionOptionCreate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> QuestionOptionResponse:
    question = db.query(Question).options(joinedload(Question.quiz)).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    _check_quiz_ownership(question.quiz, current_user, db)

    order_index = option_in.order_index
    if order_index is None:
        max_order = db.query(func.max(QuestionOption.order_index)).filter(QuestionOption.question_id == question_id).scalar()
        order_index = (max_order or 0) + 1

    option = QuestionOption(
        question_id=question_id,
        option_text=option_in.option_text,
        is_correct=option_in.is_correct,
        order_index=order_index,
    )
    db.add(option)
    db.commit()
    db.refresh(option)
    return option


@router.patch(
    "/quizzes/options/{option_id}",
    response_model=QuestionOptionResponse,
    status_code=status.HTTP_200_OK,
    summary="Update question option (Owner Instructor / Admin)",
)
def update_question_option(
    option_id: uuid.UUID,
    option_update: QuestionOptionUpdate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> QuestionOptionResponse:
    option = db.query(QuestionOption).filter(QuestionOption.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")
    question = db.query(Question).filter(Question.id == option.question_id).first()
    quiz = db.query(Quiz).filter(Quiz.id == question.quiz_id).first()
    _check_quiz_ownership(quiz, current_user, db)

    if option_update.option_text is not None:
        option.option_text = option_update.option_text
    if option_update.is_correct is not None:
        option.is_correct = option_update.is_correct
    if option_update.order_index is not None and option_update.order_index != option.order_index:
        conflict = (
            db.query(QuestionOption)
            .filter(QuestionOption.question_id == option.question_id, QuestionOption.order_index == option_update.order_index, QuestionOption.id != option_id)
            .first()
        )
        if conflict:
            raise HTTPException(status_code=400, detail=f"Option with order_index {option_update.order_index} already exists")
        option.order_index = option_update.order_index

    db.commit()
    db.refresh(option)
    return option


@router.delete(
    "/quizzes/options/{option_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete question option (Owner Instructor / Admin)",
)
def delete_question_option(
    option_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    option = db.query(QuestionOption).filter(QuestionOption.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")
    question = db.query(Question).filter(Question.id == option.question_id).first()
    quiz = db.query(Quiz).filter(Quiz.id == question.quiz_id).first()
    _check_quiz_ownership(quiz, current_user, db)

    db.delete(option)
    db.commit()
    return MessageResponse(message="Option deleted successfully")


# ---------------------------------------------------------------------------
# AI Quiz Draft Quarantine Workflow
# ---------------------------------------------------------------------------
@router.post(
    "/lessons/{lesson_id}/ai-drafts",
    response_model=AIQuizDraftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create AI quiz draft in quarantine (Owner Instructor / Admin)",
)
def create_ai_quiz_draft(
    lesson_id: uuid.UUID,
    draft_in: AIQuizDraftCreate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AIQuizDraftResponse:
    """
    Quarantines raw AI-generated questions into i_quiz_drafts with PENDING_REVIEW status.
    AI questions NEVER go directly into active quizzes without instructor review.
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    module = db.query(Module).filter(Module.id == lesson.module_id).first()
    course = db.query(Course).filter(Course.id == module.course_id).first()
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to generate AI drafts for this lesson")

    draft = AIQuizDraft(
        lesson_id=lesson_id,
        instructor_id=current_user.id,
        prompt_context=draft_in.prompt_context,
        raw_llm_response=draft_in.raw_llm_response,
        status=AIDraftStatus.PENDING_REVIEW,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


@router.post(
    "/lessons/{lesson_id}/ai-generate",
    response_model=AIQuizDraftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate AI quiz questions for a lesson via NVIDIA Llama 3.1",
)
def generate_ai_quiz_for_lesson(
    lesson_id: uuid.UUID,
    request: AIQuizGenerateRequest,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AIQuizDraftResponse:
    """
    Calls NVIDIA's OpenAI-compatible API to generate structured quiz questions
    based on the lesson's title, body, and course context.
    Validates output via Pydantic and stores the result as an AIQuizDraft with PENDING_REVIEW status.
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    module = db.query(Module).filter(Module.id == lesson.module_id).first()
    course = db.query(Course).filter(Course.id == module.course_id).first()
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to generate AI drafts for this lesson")

    # Grounding priority:
    # 1. Lesson content body
    # 2. Extracted text from uploaded document
    # 3. Video transcript (if present)
    grounded_parts = []
    if lesson.content_body and lesson.content_body.strip():
        grounded_parts.append(lesson.content_body.strip())

    if lesson.document_url:
        doc_text = extract_text_from_document(lesson.document_url)
        if doc_text:
            grounded_parts.append(f"Document Reference Content:\n{doc_text}")

    combined_content = "\n\n".join(grounded_parts).strip()
    if len(combined_content) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient lesson learning content to generate quiz questions. Please add lesson text or attach reference materials before generating questions.",
        )

    validated_payload, raw_dict = generate_quiz_questions(
        course_title=course.title,
        module_title=module.title,
        lesson_titles=[lesson.title],
        lesson_content=combined_content,
        difficulty=request.difficulty or "INTERMEDIATE",
        num_questions=request.num_questions,
        question_types=request.question_types,
        custom_instructions=request.custom_instructions,
    )

    draft = AIQuizDraft(
        lesson_id=lesson_id,
        instructor_id=current_user.id,
        prompt_context=request.custom_instructions or f"Auto-generated for lesson: {lesson.title}",
        raw_llm_response=raw_dict,
        status=AIDraftStatus.PENDING_REVIEW,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


@router.get(
    "/modules/{module_id}/quiz",
    response_model=QuizResponse,
    status_code=status.HTTP_200_OK,
    summary="Get active quiz for a module (Authoring mode)",
)
def get_module_quiz(
    module_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> QuizResponse:
    """
    Returns the active module assessment quiz for instructor authoring and preview.
    """
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    course = db.query(Course).filter(Course.id == module.course_id).first()
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to view quizzes for this course")

    quiz = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
        .filter(Quiz.module_id == module_id, Quiz.quiz_type == QuizType.MODULE, Quiz.is_active == True)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="No quiz configured for this module")
    return quiz


@router.get(
    "/courses/{course_id}/final-quiz",
    response_model=QuizResponse,
    status_code=status.HTTP_200_OK,
    summary="Get active final certification exam quiz for a course (Authoring mode)",
)
def get_course_final_quiz(
    course_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> QuizResponse:
    """
    Returns the active final course assessment quiz for instructor authoring.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to view quizzes for this course")

    quiz = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
        .filter(Quiz.course_id == course_id, Quiz.quiz_type == QuizType.FINAL, Quiz.is_active == True)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="No final certification exam configured for this course")
    return quiz


@router.get(
    "/courses/{course_id}/quizzes",
    response_model=List[QuizResponse],
    status_code=status.HTTP_200_OK,
    summary="List all module and final assessment quizzes for a course",
)
def list_course_quizzes(
    course_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> List[QuizResponse]:
    """
    Lists all module quizzes and course final exam quizzes for authoring.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to view quizzes for this course")

    module_ids = [m.id for m in db.query(Module.id).filter(Module.course_id == course_id).all()]

    quizzes = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
        .filter(
            (Quiz.course_id == course_id) | (Quiz.module_id.in_(module_ids)),
            Quiz.is_active == True,
        )
        .all()
    )
    return quizzes


@router.post(
    "/modules/{module_id}/ai-generate",
    response_model=AIQuizDraftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate AI quiz questions for a module with selective grounding",
)
def generate_ai_quiz_for_module(
    module_id: uuid.UUID,
    request: AIQuizGenerateRequest,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AIQuizDraftResponse:
    """
    Calls NVIDIA's OpenAI-compatible API to generate grounded module assessment questions
    incorporating selected lessons and/or uploaded documents inside the module.
    Quarantines draft as an AIQuizDraft with PENDING_REVIEW status.
    """
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    course = db.query(Course).filter(Course.id == module.course_id).first()
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to generate AI drafts for this module")

    lessons_query = db.query(Lesson).filter(Lesson.module_id == module_id)
    if request.lesson_ids:
        lessons_query = lessons_query.filter(Lesson.id.in_(request.lesson_ids))
    lessons = lessons_query.order_by(Lesson.order_index.asc()).all()

    grounded_parts = []
    lesson_titles = []
    for l in lessons:
        lesson_titles.append(l.title)
        l_parts = []
        if l.content_body and l.content_body.strip():
            l_parts.append(l.content_body.strip())
        if l.document_url and (not request.document_urls or l.document_url in request.document_urls):
            d_text = extract_text_from_document(l.document_url)
            if d_text:
                l_parts.append(f"Document Material ({l.title}):\n{d_text}")
        if l_parts:
            grounded_parts.append(f"--- Lesson: {l.title} ---\n" + "\n\n".join(l_parts))

    # Also extract any standalone requested document URLs
    if request.document_urls:
        for doc_url in request.document_urls:
            doc_already_included = any(doc_url in part for part in grounded_parts)
            if not doc_already_included:
                extracted = extract_text_from_document(doc_url)
                if extracted:
                    grounded_parts.append(f"Document Material:\n{extracted}")

    combined_content = "\n\n".join(grounded_parts).strip()
    if len(combined_content) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient source material to generate reliable quiz questions. Please select or add more learning content.",
        )

    validated_payload, raw_dict = generate_quiz_questions(
        course_title=course.title,
        module_title=module.title,
        lesson_titles=lesson_titles if lesson_titles else [module.title],
        lesson_content=combined_content,
        difficulty=request.difficulty or "INTERMEDIATE",
        num_questions=request.num_questions,
        question_types=request.question_types,
        custom_instructions=request.custom_instructions,
    )

    representative_lesson = lessons[0] if lessons else db.query(Lesson).filter(Lesson.module_id == module_id).first()
    if not representative_lesson:
        raise HTTPException(status_code=400, detail="Module must contain at least one lesson")

    draft = AIQuizDraft(
        lesson_id=representative_lesson.id,
        instructor_id=current_user.id,
        prompt_context=request.custom_instructions or f"Auto-generated for module: {module.title}",
        raw_llm_response=raw_dict,
        status=AIDraftStatus.PENDING_REVIEW,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


@router.post(
    "/courses/{course_id}/ai-generate",
    response_model=AIQuizDraftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate AI quiz questions for Course Final Assessment with selective module grounding",
)
def generate_ai_quiz_for_course(
    course_id: uuid.UUID,
    request: AIQuizGenerateRequest,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AIQuizDraftResponse:
    """
    Calls NVIDIA's OpenAI-compatible API to generate comprehensive Final Course Assessment questions
    incorporating selected modules and/or attached documents.
    Quarantines draft as an AIQuizDraft with PENDING_REVIEW status.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to generate AI drafts for this course")

    modules_query = db.query(Module).filter(Module.course_id == course_id)
    if request.module_ids:
        modules_query = modules_query.filter(Module.id.in_(request.module_ids))
    modules = modules_query.order_by(Module.order_index.asc()).all()

    if not modules:
        raise HTTPException(status_code=400, detail="Course must contain at least one module to generate final assessment")

    grounded_parts = []
    lesson_titles = []
    first_lesson = None

    for mod in modules:
        mod_lessons = db.query(Lesson).filter(Lesson.module_id == mod.id).order_by(Lesson.order_index.asc()).all()
        if not first_lesson and mod_lessons:
            first_lesson = mod_lessons[0]

        mod_parts = []
        for l in mod_lessons:
            if request.lesson_ids and l.id not in request.lesson_ids:
                continue
            lesson_titles.append(l.title)
            if l.content_body and l.content_body.strip():
                mod_parts.append(l.content_body.strip())
            if l.document_url and (not request.document_urls or l.document_url in request.document_urls):
                d_text = extract_text_from_document(l.document_url)
                if d_text:
                    mod_parts.append(f"Document Material ({l.title}):\n{d_text}")

        if mod_parts:
            grounded_parts.append(f"=== Module: {mod.title} ===\n" + "\n\n".join(mod_parts))

    # Also extract any standalone requested document URLs
    if request.document_urls:
        for doc_url in request.document_urls:
            doc_already_included = any(doc_url in part for part in grounded_parts)
            if not doc_already_included:
                extracted = extract_text_from_document(doc_url)
                if extracted:
                    grounded_parts.append(f"Document Reference Content:\n{extracted}")

    combined_content = "\n\n".join(grounded_parts).strip()
    if len(combined_content) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient source material to generate reliable quiz questions. Please select or add more learning content.",
        )

    validated_payload, raw_dict = generate_quiz_questions(
        course_title=course.title,
        module_title=f"Comprehensive Final Assessment ({course.title})",
        lesson_titles=lesson_titles[:10],
        lesson_content=combined_content,
        difficulty=request.difficulty or "ADVANCED",
        num_questions=request.num_questions,
        question_types=request.question_types,
        custom_instructions=request.custom_instructions or "Generate a rigorous final certification assessment covering core competencies.",
    )

    if not first_lesson:
        raise HTTPException(status_code=400, detail="Course must contain at least one lesson to quarantine draft")

    draft = AIQuizDraft(
        lesson_id=first_lesson.id,
        instructor_id=current_user.id,
        prompt_context=request.custom_instructions or f"Auto-generated Final Exam for course: {course.title}",
        raw_llm_response=raw_dict,
        status=AIDraftStatus.PENDING_REVIEW,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


@router.get(
    "/ai-drafts/{draft_id}",
    response_model=AIQuizDraftResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single AI quiz draft details",
)
def get_ai_quiz_draft(
    draft_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AIQuizDraftResponse:
    draft = db.query(AIQuizDraft).filter(AIQuizDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="AI draft not found")

    lesson = db.query(Lesson).filter(Lesson.id == draft.lesson_id).first()
    module = db.query(Module).filter(Module.id == lesson.module_id).first()
    course = db.query(Course).filter(Course.id == module.course_id).first()
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to view this AI draft")

    return draft


@router.get(
    "/lessons/{lesson_id}/ai-drafts",
    response_model=List[AIQuizDraftResponse],
    status_code=status.HTTP_200_OK,
    summary="List quarantined AI drafts for a lesson",
)
def list_ai_quiz_drafts(
    lesson_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> List[AIQuizDraftResponse]:
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    module = db.query(Module).filter(Module.id == lesson.module_id).first()
    course = db.query(Course).filter(Course.id == module.course_id).first()
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to view AI drafts for this lesson")

    drafts = (
        db.query(AIQuizDraft)
        .filter(AIQuizDraft.lesson_id == lesson_id)
        .order_by(AIQuizDraft.created_at.desc())
        .all()
    )
    return drafts


@router.get(
    "/modules/{module_id}/ai-drafts",
    response_model=List[AIQuizDraftResponse],
    status_code=status.HTTP_200_OK,
    summary="List quarantined AI drafts for a module",
)
def list_module_ai_drafts(
    module_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> List[AIQuizDraftResponse]:
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    course = db.query(Course).filter(Course.id == module.course_id).first()
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to view AI drafts for this module")

    lesson_ids = [l.id for l in module.lessons]
    drafts = (
        db.query(AIQuizDraft)
        .filter(AIQuizDraft.lesson_id.in_(lesson_ids))
        .order_by(AIQuizDraft.created_at.desc())
        .all()
    )
    return drafts


@router.get(
    "/courses/{course_id}/ai-drafts",
    response_model=List[AIQuizDraftResponse],
    status_code=status.HTTP_200_OK,
    summary="List quarantined AI drafts for a course",
)
def list_course_ai_drafts(
    course_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> List[AIQuizDraftResponse]:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to view AI drafts for this course")

    all_lesson_ids = []
    for mod in course.modules:
        all_lesson_ids.extend([l.id for l in mod.lessons])

    drafts = (
        db.query(AIQuizDraft)
        .filter(AIQuizDraft.lesson_id.in_(all_lesson_ids))
        .order_by(AIQuizDraft.created_at.desc())
        .all()
    )
    return drafts


def _parse_bool(val: Any) -> bool:
    """
    Safely parses boolean values from LLM/JSON responses,
    preventing string values like 'false' from evaluating to True.
    """
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes", "t", "y")
    if isinstance(val, (int, float)):
        return val == 1
    return False


@router.post(
    "/ai-drafts/{draft_id}/review",
    response_model=AIQuizDraftResponse,
    status_code=status.HTTP_200_OK,
    summary="Review & optionally approve AI quiz draft into live quiz",
)
def review_ai_quiz_draft(
    draft_id: uuid.UUID,
    review_in: AIQuizDraftReviewRequest,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AIQuizDraftResponse:
    """
    Instructor/Admin review gate:
    - AI draft can only be reviewed ONCE (must be in PENDING_REVIEW status).
    - If APPROVED and import_to_quiz=True: Parses the approved AI generated questions
      and converts them into actual Question and QuestionOption records on the target quiz (Lesson, Module, or Final Exam).
    - If DISCARDED: Updates status and leaves draft quarantined.
    """
    draft = db.query(AIQuizDraft).filter(AIQuizDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="AI draft not found")

    if draft.status != AIDraftStatus.PENDING_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"AI draft has already been reviewed (current status: {draft.status.value})",
        )

    lesson = db.query(Lesson).filter(Lesson.id == draft.lesson_id).first()
    module = db.query(Module).filter(Module.id == lesson.module_id).first()
    course = db.query(Course).filter(Course.id == module.course_id).first()
    if current_user.role != UserRole.ADMIN and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to review this AI draft")

    draft.status = review_in.status
    draft.reviewed_at = datetime.now(timezone.utc)

    if review_in.status == AIDraftStatus.APPROVED and review_in.import_to_quiz:
        target_type = review_in.target_type or QuizType.MODULE
        quiz = None

        if review_in.target_quiz_id:
            quiz = db.query(Quiz).filter(Quiz.id == review_in.target_quiz_id).first()
        elif target_type == QuizType.MODULE:
            target_module_id = review_in.target_id or module.id
            quiz = db.query(Quiz).filter(Quiz.module_id == target_module_id, Quiz.quiz_type == QuizType.MODULE).first()
            if not quiz:
                quiz = Quiz(
                    title=f"Assessment: {module.title}",
                    quiz_type=QuizType.MODULE,
                    module_id=target_module_id,
                    passing_score=Decimal("70.00"),
                    max_attempts=2,
                    is_active=True,
                )
                db.add(quiz)
                db.flush()
        elif target_type == QuizType.FINAL:
            target_course_id = review_in.target_id or course.id
            quiz = db.query(Quiz).filter(Quiz.course_id == target_course_id, Quiz.quiz_type == QuizType.FINAL).first()
            if not quiz:
                quiz = Quiz(
                    title=f"Final Certification Exam: {course.title}",
                    quiz_type=QuizType.FINAL,
                    course_id=target_course_id,
                    passing_score=Decimal("70.00"),
                    max_attempts=3,
                    is_active=True,
                )
                db.add(quiz)
                db.flush()
        else:
            # Default: Lesson Quiz
            target_lesson_id = review_in.target_id or draft.lesson_id
            quiz = db.query(Quiz).filter(Quiz.lesson_id == target_lesson_id, Quiz.quiz_type == QuizType.LESSON).first()
            if not quiz:
                quiz = Quiz(
                    title=f"Quiz: {lesson.title}",
                    quiz_type=QuizType.LESSON,
                    lesson_id=target_lesson_id,
                    passing_score=Decimal("70.00"),
                    max_attempts=3,
                    is_active=True,
                )
                db.add(quiz)
                db.flush()

        # Parse raw_llm_response questions
        raw_items = draft.raw_llm_response
        if isinstance(raw_items, dict) and "questions" in raw_items:
            raw_items = raw_items["questions"]

        if isinstance(raw_items, list):
            for q_data in raw_items:
                if isinstance(q_data, dict):
                    max_order = db.query(func.max(Question.order_index)).filter(Question.quiz_id == quiz.id).scalar()
                    q_order = (max_order or 0) + 1

                    q_type = QuestionType.MCQ
                    type_str = str(q_data.get("question_type", "")).upper()
                    if type_str == "TRUE_FALSE":
                        q_type = QuestionType.TRUE_FALSE
                    elif type_str == "MULTI_SELECT":
                        q_type = QuestionType.MULTI_SELECT

                    question = Question(
                        quiz_id=quiz.id,
                        question_text=q_data.get("question_text", "Untitled Question"),
                        question_type=q_type,
                        explanation=q_data.get("explanation"),
                        points=int(q_data.get("points", 1)),
                        order_index=q_order,
                    )
                    db.add(question)
                    db.flush()

                    for idx, opt_data in enumerate(q_data.get("options", [])):
                        if isinstance(opt_data, dict):
                            opt = QuestionOption(
                                question_id=question.id,
                                option_text=opt_data.get("option_text", f"Option {idx + 1}"),
                                is_correct=_parse_bool(opt_data.get("is_correct", False)),
                                order_index=idx + 1,
                            )
                            db.add(opt)

    db.commit()
    db.refresh(draft)
    return draft


# ---------------------------------------------------------------------------
# Quiz Submission & Scoring Engine
# ---------------------------------------------------------------------------
@router.post(
    "/quizzes/{quiz_id}/submit",
    response_model=QuizSubmissionResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit answers for a quiz, evaluate score, track attempts and relearning",
)
def submit_quiz_answers(
    quiz_id: uuid.UUID,
    submission: QuizSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizSubmissionResultResponse:
    """
    Evaluates learner quiz submissions, computes score and passing status,
    updates module/enrollment progress, and triggers relearning if max attempts are exceeded.
    """
    quiz = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
        .filter(Quiz.id == quiz_id, Quiz.is_active == True)
        .first()
    )
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found or is inactive",
        )

    # 1. Resolve Course hierarchy and Enrollment
    course = _get_quiz_course(quiz, db)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent course hierarchy for quiz not found",
        )

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course.id,
            Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED]),
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be actively enrolled in this course to take quizzes",
        )

    # 2. Prerequisites & Lock Checks
    module_progress = None
    target_module = None

    if quiz.quiz_type == QuizType.MODULE:
        target_module = db.query(Module).filter(Module.id == quiz.module_id).first()
        if not target_module:
            raise HTTPException(status_code=404, detail="Target module not found")

        # Check prerequisite modules unlock
        prev_required_modules = (
            db.query(Module)
            .filter(
                Module.course_id == course.id,
                Module.order_index < target_module.order_index,
                Module.is_required == True,
            )
            .all()
        )
        for prev_m in prev_required_modules:
            prev_prog = (
                db.query(ModuleProgress)
                .filter(
                    ModuleProgress.enrollment_id == enrollment.id,
                    ModuleProgress.module_id == prev_m.id,
                )
                .first()
            )
            if not prev_prog or prev_prog.status != ModuleProgressStatus.COMPLETED:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Module '{target_module.title}' is locked. Complete previous required modules first.",
                )

        # Get or create module_progress
        module_progress = (
            db.query(ModuleProgress)
            .filter(
                ModuleProgress.enrollment_id == enrollment.id,
                ModuleProgress.module_id == target_module.id,
            )
            .first()
        )
        if not module_progress:
            module_progress = ModuleProgress(
                enrollment_id=enrollment.id,
                module_id=target_module.id,
                status=ModuleProgressStatus.IN_PROGRESS,
                attempts_used=0,
                started_at=datetime.now(timezone.utc),
            )
            db.add(module_progress)
            db.flush()

        if module_progress.status == ModuleProgressStatus.NEEDS_RELEARNING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Module is in NEEDS_RELEARNING status. You must re-study and reset lessons before attempting the quiz again.",
            )

        # Enforce that all lessons in this module are completed before taking module quiz
        module_lessons = db.query(Lesson).filter(Lesson.module_id == target_module.id).all()
        if module_lessons:
            completed_lesson_count = (
                db.query(LessonProgress)
                .filter(
                    LessonProgress.module_progress_id == module_progress.id,
                    LessonProgress.is_completed == True,
                )
                .count()
            )
            if completed_lesson_count < len(module_lessons):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"All {len(module_lessons)} lessons in module '{target_module.title}' must be completed before attempting the module quiz.",
                )

        # Enforce 2-attempt limit for module quiz completion cycle
        max_cycle_attempts = 2 if quiz.quiz_type == QuizType.MODULE else quiz.max_attempts
        if module_progress.attempts_used >= max_cycle_attempts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum quiz attempts ({max_cycle_attempts}) reached for this cycle. Relearning required.",
            )

    elif quiz.quiz_type == QuizType.FINAL:
        # Check that all required modules are COMPLETED
        required_modules = (
            db.query(Module)
            .filter(Module.course_id == course.id, Module.is_required == True)
            .all()
        )
        for req_m in required_modules:
            m_prog = (
                db.query(ModuleProgress)
                .filter(
                    ModuleProgress.enrollment_id == enrollment.id,
                    ModuleProgress.module_id == req_m.id,
                )
                .first()
            )
            if not m_prog or m_prog.status != ModuleProgressStatus.COMPLETED:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Final exam is locked. All required modules must be completed first.",
                )

    # 3. Determine attempt_number and attempt_cycle
    past_attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current_user.id, QuizAttempt.quiz_id == quiz.id)
        .order_by(QuizAttempt.attempt_number.asc())
        .all()
    )
    attempt_number = len(past_attempts) + 1

    if quiz.quiz_type == QuizType.MODULE and module_progress:
        if not past_attempts:
            attempt_cycle = 1
        else:
            # If attempts_used is 0, this is the start of a new relearning cycle
            if module_progress.attempts_used == 0 and not past_attempts[-1].is_passed:
                attempt_cycle = past_attempts[-1].attempt_cycle + 1
            else:
                attempt_cycle = past_attempts[-1].attempt_cycle
    else:
        attempt_cycle = 1
        max_attempts_limit = 2 if quiz.quiz_type == QuizType.MODULE else quiz.max_attempts
        if len(past_attempts) >= max_attempts_limit and not any(a.is_passed for a in past_attempts):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum quiz attempts ({max_attempts_limit}) reached.",
            )

    # 4. Grading & Scoring
    answers_map = {ans.question_id: set(ans.selected_option_ids) for ans in submission.answers}
    total_possible_points = 0
    earned_points = 0
    question_results: List[QuestionResultResponse] = []

    for question in sorted(quiz.questions, key=lambda q: q.order_index):
        total_possible_points += question.points
        correct_option_ids = {opt.id for opt in question.options if opt.is_correct}
        selected_option_ids = answers_map.get(question.id, set())

        is_correct = False
        if question.question_type in (QuestionType.MCQ, QuestionType.TRUE_FALSE):
            if len(selected_option_ids) == 1 and selected_option_ids == correct_option_ids:
                is_correct = True
        elif question.question_type == QuestionType.MULTI_SELECT:
            if selected_option_ids == correct_option_ids and len(correct_option_ids) > 0:
                is_correct = True

        pts = question.points if is_correct else 0
        earned_points += pts

        question_results.append(
            QuestionResultResponse(
                question_id=question.id,
                is_correct=is_correct,
                points_awarded=pts,
                max_points=question.points,
                explanation=question.explanation,
                selected_option_ids=list(selected_option_ids),
                correct_option_ids=list(correct_option_ids),
            )
        )

    if total_possible_points > 0:
        score_pct = Decimal(str(round((earned_points / total_possible_points) * 100, 2)))
    else:
        score_pct = Decimal("100.00")

    is_passed = score_pct >= quiz.passing_score
    relearning_triggered = False
    max_cycle_limit = 2 if quiz.quiz_type == QuizType.MODULE else quiz.max_attempts

    # 5. Handle Side-Effects
    if quiz.quiz_type == QuizType.MODULE and module_progress:
        module_progress.attempts_used += 1
        if is_passed:
            module_progress.status = ModuleProgressStatus.COMPLETED
            module_progress.completed_at = datetime.now(timezone.utc)
        else:
            if module_progress.attempts_used >= max_cycle_limit:
                module_progress.status = ModuleProgressStatus.NEEDS_RELEARNING
                module_progress.relearning_triggered_at = datetime.now(timezone.utc)
                relearning_triggered = True
                # Reset all lesson completion flags for this module
                db.query(LessonProgress).filter(
                    LessonProgress.module_progress_id == module_progress.id
                ).update(
                    {LessonProgress.is_completed: False, LessonProgress.completed_at: None},
                    synchronize_session="fetch",
                )

    elif quiz.quiz_type == QuizType.LESSON and quiz.lesson_id and is_passed:
        lesson = db.query(Lesson).filter(Lesson.id == quiz.lesson_id).first()
        if lesson and lesson.module_id:
            m_prog = (
                db.query(ModuleProgress)
                .filter(
                    ModuleProgress.enrollment_id == enrollment.id,
                    ModuleProgress.module_id == lesson.module_id,
                )
                .first()
            )
            if m_prog:
                l_prog = (
                    db.query(LessonProgress)
                    .filter(
                        LessonProgress.module_progress_id == m_prog.id,
                        LessonProgress.lesson_id == lesson.id,
                    )
                    .first()
                )
                if l_prog:
                    l_prog.is_completed = True
                    l_prog.completed_at = datetime.now(timezone.utc)

    elif quiz.quiz_type == QuizType.FINAL and is_passed:
        enrollment.status = EnrollmentStatus.COMPLETED
        enrollment.completed_at = datetime.now(timezone.utc)

        # Automatically issue Certificate row if course offers certificates and not already issued
        if getattr(course, "has_certificate", True):
            existing_cert = db.query(Certificate).filter(Certificate.enrollment_id == enrollment.id).first()
            if not existing_cert:
                import secrets
                import hashlib
                year = datetime.now(timezone.utc).year
                cert_num = f"DC-{year}-{secrets.token_hex(4).upper()}"
                ver_hash = hashlib.sha256(
                    f"{current_user.id}:{course.id}:{datetime.now(timezone.utc).isoformat()}".encode("utf-8")
                ).hexdigest()
                cert = Certificate(
                    enrollment_id=enrollment.id,
                    user_id=current_user.id,
                    course_id=course.id,
                    certificate_number=cert_num,
                    issued_at=datetime.now(timezone.utc),
                    verification_hash=ver_hash,
                )
                db.add(cert)

    # 6. Insert Append-Only Quiz Attempt Log
    attempt = QuizAttempt(
        user_id=current_user.id,
        quiz_id=quiz.id,
        module_progress_id=module_progress.id if (quiz.quiz_type == QuizType.MODULE and module_progress) else None,
        attempt_number=attempt_number,
        attempt_cycle=attempt_cycle,
        score_achieved=score_pct,
        is_passed=is_passed,
        submitted_answers=[ans.model_dump(mode="json") for ans in submission.answers],
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return QuizSubmissionResultResponse(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        attempt_number=attempt_number,
        attempt_cycle=attempt_cycle,
        score_achieved=score_pct,
        passing_score=quiz.passing_score,
        is_passed=is_passed,
        relearning_triggered=relearning_triggered,
        question_results=question_results,
    )


# ---------------------------------------------------------------------------
# Quiz Attempts History Endpoints
# ---------------------------------------------------------------------------
@router.get(
    "/quizzes/{quiz_id}/attempts",
    response_model=List[QuizAttemptResponse],
    status_code=status.HTTP_200_OK,
    summary="Get user's past attempts for a quiz",
)
def get_quiz_attempts(
    quiz_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[QuizAttemptResponse]:
    """
    Returns attempt history for the authenticated learner on this quiz.
    """
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current_user.id, QuizAttempt.quiz_id == quiz_id)
        .order_by(QuizAttempt.attempt_number.asc())
        .all()
    )
    return attempts


@router.get(
    "/attempts/{attempt_id}",
    response_model=QuizAttemptResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a specific quiz attempt detail",
)
def get_attempt_detail(
    attempt_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizAttemptResponse:
    """
    Returns details of a specific quiz attempt.
    Learners can only view their own attempts; instructors and admins can view any attempt.
    """
    attempt = db.query(QuizAttempt).filter(QuizAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")

    if current_user.role not in (UserRole.ADMIN, UserRole.INSTRUCTOR) and attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to view this attempt")

    return attempt
