import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        doc="Mirrors Supabase auth.users(id)",
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        ENUM(UserRole, name="user_role", create_type=False),
        nullable=False,
        default=UserRole.USER,
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    interests: Mapped[List["UserInterest"]] = relationship(
        "UserInterest", back_populates="user", cascade="all, delete-orphan"
    )
    authored_courses: Mapped[List["Course"]] = relationship(  # type: ignore[name-defined]
        "Course", back_populates="instructor"
    )
    enrollments: Mapped[List["Enrollment"]] = relationship(  # type: ignore[name-defined]
        "Enrollment", back_populates="user", cascade="all, delete-orphan"
    )
    quiz_attempts: Mapped[List["QuizAttempt"]] = relationship(  # type: ignore[name-defined]
        "QuizAttempt", back_populates="user", cascade="all, delete-orphan"
    )
    certificates: Mapped[List["Certificate"]] = relationship(  # type: ignore[name-defined]
        "Certificate", back_populates="user", cascade="all, delete-orphan"
    )


class UserInterest(Base):
    __tablename__ = "user_interests"
    __table_args__ = (
        UniqueConstraint("user_id", "sub_domain_id", name="uq_user_interests_user_subdomain"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    sub_domain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sub_domains.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="interests")
    sub_domain: Mapped["SubDomain"] = relationship(  # type: ignore[name-defined]
        "SubDomain", back_populates="user_interests"
    )
