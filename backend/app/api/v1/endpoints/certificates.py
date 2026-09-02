import uuid
import secrets
import hashlib
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.course import Course, Module
from app.models.quiz import Quiz
from app.models.assessment import QuizAttempt, Certificate
from app.models.enrollment import Enrollment, ModuleProgress
from app.models.enums import UserRole, EnrollmentStatus, ModuleProgressStatus, QuizType
from app.schemas.assessment import (
    CertificateResponse,
    CertificateVerifyResponse,
)

router = APIRouter(tags=["Certificates & Credentials"])


def _generate_certificate_number(db: Session) -> str:
    """Generates a human-readable unique certificate number, e.g. DC-2026-ABCD1234."""
    year = datetime.now(timezone.utc).year
    for _ in range(10):
        suffix = secrets.token_hex(4).upper()
        cert_num = f"DC-{year}-{suffix}"
        existing = db.query(Certificate).filter(Certificate.certificate_number == cert_num).first()
        if not existing:
            return cert_num
    # Fallback with uuid if collision occurs repeatedly
    return f"DC-{year}-{uuid.uuid4().hex[:8].upper()}"


def clean_learner_name(full_name: Optional[str]) -> str:
    """
    Cleans student registration/roll numbers merged into user full names.
    E.g. '727822TUAD054 SRINITHI.V' -> 'SRINITHI.V'
    """
    if not full_name:
        return "Learner"
    trimmed = full_name.strip()
    parts = trimmed.split()
    if len(parts) > 1 and any(c.isdigit() for c in parts[0]) and any(c.isalpha() for c in parts[0]):
        return " ".join(parts[1:])
    return trimmed


def _build_certificate_response(cert: Certificate, db: Session) -> CertificateResponse:
    """
    Constructs a CertificateResponse with full course and learner snapshot data
    derived authoritatively from the certificate record.
    """
    student = db.query(User).filter(User.id == cert.user_id).first()
    course = db.query(Course).filter(Course.id == cert.course_id).first()
    instructor = (
        db.query(User).filter(User.id == course.instructor_id).first()
        if (course and course.instructor_id)
        else None
    )

    student_name = clean_learner_name(student.full_name) if student else "Learner"
    course_title = course.title if course else "Course"
    course_slug = course.slug if course else None
    instructor_name = clean_learner_name(instructor.full_name) if instructor else "Course Faculty"

    return CertificateResponse(
        id=cert.id,
        enrollment_id=cert.enrollment_id,
        user_id=cert.user_id,
        course_id=cert.course_id,
        certificate_number=cert.certificate_number,
        issued_at=cert.issued_at,
        pdf_storage_path=cert.pdf_storage_path,
        verification_hash=cert.verification_hash,
        student_name=student_name,
        course_title=course_title,
        course_slug=course_slug,
        instructor_name=instructor_name,
    )


@router.post(
    "/courses/{course_id}/certificate",
    response_model=CertificateResponse,
    status_code=status.HTTP_200_OK,
    summary="Claim certificate for a completed course",
)
def claim_certificate(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CertificateResponse:
    """
    Validates course completion prerequisites (all required modules completed,
    final exam passed if applicable) and issues a cryptographically hashed certificate.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not getattr(course, "has_certificate", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This course does not offer a certificate of completion",
        )

    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
        .first()
    )
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this course",
        )

    # If certificate already issued, return existing certificate (idempotent)
    existing_cert = db.query(Certificate).filter(Certificate.enrollment_id == enrollment.id).first()
    if existing_cert:
        return _build_certificate_response(existing_cert, db)

    # 1. Verify all required modules are COMPLETED
    required_modules = (
        db.query(Module)
        .filter(Module.course_id == course_id, Module.is_required == True)
        .all()
    )
    for m in required_modules:
        m_prog = (
            db.query(ModuleProgress)
            .filter(
                ModuleProgress.enrollment_id == enrollment.id,
                ModuleProgress.module_id == m.id,
            )
            .first()
        )
        if not m_prog or m_prog.status != ModuleProgressStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Certificate ineligible: Required module '{m.title}' is not completed yet",
            )

    # 2. Verify Final Exam is passed (if the course has an active FINAL quiz)
    final_quiz = (
        db.query(Quiz)
        .filter(Quiz.course_id == course_id, Quiz.quiz_type == QuizType.FINAL, Quiz.is_active == True)
        .first()
    )
    if final_quiz:
        passed_final = (
            db.query(QuizAttempt)
            .filter(
                QuizAttempt.user_id == current_user.id,
                QuizAttempt.quiz_id == final_quiz.id,
                QuizAttempt.is_passed == True,
            )
            .first()
        )
        if not passed_final:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Certificate ineligible: Course final exam has not been passed",
            )

    # 3. Mark enrollment as COMPLETED if not already
    now = datetime.now(timezone.utc)
    if enrollment.status != EnrollmentStatus.COMPLETED:
        enrollment.status = EnrollmentStatus.COMPLETED
        enrollment.completed_at = now

    # 4. Generate Certificate
    cert_number = _generate_certificate_number(db)
    verification_hash = hashlib.sha256(
        f"{current_user.id}:{course_id}:{now.isoformat()}".encode("utf-8")
    ).hexdigest()

    certificate = Certificate(
        enrollment_id=enrollment.id,
        user_id=current_user.id,
        course_id=course_id,
        certificate_number=cert_number,
        issued_at=now,
        verification_hash=verification_hash,
    )
    db.add(certificate)
    db.commit()
    db.refresh(certificate)

    return _build_certificate_response(certificate, db)


@router.get(
    "/certificates/me",
    response_model=List[CertificateResponse],
    status_code=status.HTTP_200_OK,
    summary="List all certificates earned by current user",
)
@router.get(
    "/certificates",
    response_model=List[CertificateResponse],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def get_my_certificates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[CertificateResponse]:
    """
    Returns list of certificates earned by the authenticated user with authoritative course metadata.
    """
    certificates = (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id)
        .order_by(Certificate.issued_at.desc())
        .all()
    )
    return [_build_certificate_response(c, db) for c in certificates]


@router.get(
    "/certificates/{certificate_id}",
    response_model=CertificateResponse,
    status_code=status.HTTP_200_OK,
    summary="Get certificate details",
)
def get_certificate(
    certificate_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CertificateResponse:
    """
    Returns certificate details. Learner can view their own; admin and instructor can view any.
    """
    cert = db.query(Certificate).filter(Certificate.id == certificate_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    if current_user.role not in (UserRole.ADMIN, UserRole.INSTRUCTOR) and cert.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to view this certificate")

    return _build_certificate_response(cert, db)


@router.get(
    "/certificates/verify/{certificate_number_or_hash}",
    response_model=CertificateVerifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Publicly verify a certificate by certificate number or SHA-256 hash",
)
def verify_certificate(
    certificate_number_or_hash: str,
    db: Session = Depends(get_db),
) -> CertificateVerifyResponse:
    """
    Public verification endpoint (unauthenticated).
    Searches by certificate number or SHA-256 verification hash and confirms authenticity
    strictly using the certificate record's authoritative course and user associations.
    """
    identifier = certificate_number_or_hash.strip()
    cert = (
        db.query(Certificate)
        .filter(
            (Certificate.certificate_number == identifier)
            | (Certificate.verification_hash == identifier)
        )
        .first()
    )

    if not cert:
        return CertificateVerifyResponse(
            is_valid=False,
            verification_hash=identifier,
        )

    student = db.query(User).filter(User.id == cert.user_id).first()
    course = db.query(Course).filter(Course.id == cert.course_id).first()
    instructor = (
        db.query(User).filter(User.id == course.instructor_id).first()
        if (course and course.instructor_id)
        else None
    )

    student_name = clean_learner_name(student.full_name) if student else "Learner"
    course_title = course.title if course else "Course"
    instructor_name = clean_learner_name(instructor.full_name) if instructor else "Course Faculty"

    return CertificateVerifyResponse(
        is_valid=True,
        certificate_number=cert.certificate_number,
        student_name=student_name,
        course_title=course_title,
        issued_at=cert.issued_at,
        verification_hash=cert.verification_hash,
        instructor_name=instructor_name,
    )
