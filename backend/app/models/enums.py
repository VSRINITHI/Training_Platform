import enum


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    INSTRUCTOR = "INSTRUCTOR"
    USER = "USER"


class DifficultyLevel(str, enum.Enum):
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"


class QuizType(str, enum.Enum):
    LESSON = "LESSON"
    MODULE = "MODULE"
    FINAL = "FINAL"


class QuestionType(str, enum.Enum):
    MCQ = "MCQ"
    MULTI_SELECT = "MULTI_SELECT"
    TRUE_FALSE = "TRUE_FALSE"


class AIDraftStatus(str, enum.Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    DISCARDED = "DISCARDED"


class EnrollmentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    DROPPED = "DROPPED"


class ModuleProgressStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    NEEDS_RELEARNING = "NEEDS_RELEARNING"
