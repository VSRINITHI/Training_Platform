import sys
import os
import uuid
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.taxonomy import Domain, SubDomain
from app.models.course import Course, Module, Lesson
from app.models.quiz import Quiz, Question, QuestionOption
from app.models.enums import UserRole, DifficultyLevel, QuizType, QuestionType


def seed_realistic_content():
    db = SessionLocal()
    try:
        # Find or use an active instructor user
        instructor = db.query(User).filter(User.role.in_([UserRole.INSTRUCTOR, UserRole.ADMIN])).first()
        if not instructor:
            print("No instructor found! Please ensure users exist.")
            return

        print(f"Using instructor: {instructor.full_name} ({instructor.email}) [id={instructor.id}]")

        # ==========================================
        # COURSE 1: Information Technology -> Python Programming
        # ==========================================
        it_domain = db.query(Domain).filter(Domain.slug == "information-technology").first()
        if not it_domain:
            it_domain = Domain(
                id=uuid.uuid4(),
                name="Information Technology",
                slug="information-technology",
                description="Master core software engineering, programming paradigms, and modern computer systems.",
                icon_url="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200",
            )
            db.add(it_domain)
            db.flush()
        else:
            it_domain.name = "Information Technology"
            it_domain.description = "Master core software engineering, programming paradigms, and modern computer systems."

        python_sub = db.query(SubDomain).filter(SubDomain.slug == "python-programming").first()
        if not python_sub:
            python_sub = SubDomain(
                id=uuid.uuid4(),
                domain_id=it_domain.id,
                name="Python Programming",
                slug="python-programming",
                description="Core syntax, control flow, functional programming, and data engineering with Python.",
            )
            db.add(python_sub)
            db.flush()
        else:
            python_sub.name = "Python Programming"
            python_sub.domain_id = it_domain.id

        course1 = db.query(Course).filter(Course.slug == "python-programming-fundamentals").first()
        if not course1:
            course1 = Course(
                id=uuid.uuid4(),
                instructor_id=instructor.id,
                sub_domain_id=python_sub.id,
                title="Python Programming Fundamentals",
                slug="python-programming-fundamentals",
                description="A comprehensive introduction to Python syntax, control structures, functions, and best coding practices for beginners.",
                thumbnail_url="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600",
                difficulty_level=DifficultyLevel.BEGINNER,
                is_published=True,
            )
            db.add(course1)
            db.flush()
        else:
            course1.title = "Python Programming Fundamentals"
            course1.sub_domain_id = python_sub.id
            course1.description = "A comprehensive introduction to Python syntax, control structures, functions, and best coding practices for beginners."
            course1.is_published = True

        # Course 1 - Module 1: Python Basics
        c1_m1 = db.query(Module).filter(Module.course_id == course1.id, Module.order_index == 1).first()
        if not c1_m1:
            c1_m1 = Module(
                id=uuid.uuid4(),
                course_id=course1.id,
                title="Python Basics",
                description="Foundations of Python syntax, data types, and arithmetic operations.",
                order_index=1,
                is_required=True,
            )
            db.add(c1_m1)
            db.flush()
        else:
            c1_m1.title = "Python Basics"
            c1_m1.description = "Foundations of Python syntax, data types, and arithmetic operations."
            c1_m1.is_required = True

        # C1 M1 Lessons
        c1_m1_lessons_data = [
            (1, "Introduction to Python", "Overview of Python ecosystem, installation, interactive shell, and executing your first script.", "https://example.com/videos/py-intro.mp4"),
            (2, "Variables and Data Types", "Working with integers, floats, strings, booleans, and type conversion mechanics.", "https://example.com/videos/py-variables.mp4"),
            (3, "Operators and Expressions", "Arithmetic, comparison, logical, and assignment operators in Python expressions.", "https://example.com/videos/py-operators.mp4"),
        ]
        for ord_idx, title, desc, v_url in c1_m1_lessons_data:
            les = db.query(Lesson).filter(Lesson.module_id == c1_m1.id, Lesson.order_index == ord_idx).first()
            if not les:
                les = Lesson(
                    id=uuid.uuid4(),
                    module_id=c1_m1.id,
                    title=title,
                    content_body=desc,
                    video_url=v_url,
                    order_index=ord_idx,
                )
                db.add(les)
            else:
                les.title = title
                les.content_body = desc
                les.video_url = v_url

        # Course 1 - Module 2: Control Flow and Functions
        c1_m2 = db.query(Module).filter(Module.course_id == course1.id, Module.order_index == 2).first()
        if not c1_m2:
            c1_m2 = Module(
                id=uuid.uuid4(),
                course_id=course1.id,
                title="Control Flow and Functions",
                description="Branching logic, iterative loops, function scoping, and reusable modular code.",
                order_index=2,
                is_required=True,
            )
            db.add(c1_m2)
            db.flush()
        else:
            c1_m2.title = "Control Flow and Functions"
            c1_m2.description = "Branching logic, iterative loops, function scoping, and reusable modular code."
            c1_m2.is_required = True

        # C1 M2 Lessons
        c1_m2_lessons_data = [
            (1, "Conditional Statements", "Decision-making using if, elif, and else branching structures in Python.", "https://example.com/videos/py-conditionals.mp4"),
            (2, "Loops and Iteration", "Repetitive execution using for-in loops, while loops, range generator, and break/continue statements.", "https://example.com/videos/py-loops.mp4"),
            (3, "Functions and Parameters", "Defining functions with def, default parameters, variable arguments (*args, **kwargs), and return values.", "https://example.com/videos/py-functions.mp4"),
        ]
        for ord_idx, title, desc, v_url in c1_m2_lessons_data:
            les = db.query(Lesson).filter(Lesson.module_id == c1_m2.id, Lesson.order_index == ord_idx).first()
            if not les:
                les = Lesson(
                    id=uuid.uuid4(),
                    module_id=c1_m2.id,
                    title=title,
                    content_body=desc,
                    video_url=v_url,
                    order_index=ord_idx,
                )
                db.add(les)
            else:
                les.title = title
                les.content_body = desc
                les.video_url = v_url

        # Course 1 Final Quiz
        c1_quiz = db.query(Quiz).filter(Quiz.course_id == course1.id, Quiz.quiz_type == QuizType.FINAL).first()
        if not c1_quiz:
            c1_quiz = Quiz(
                id=uuid.uuid4(),
                course_id=course1.id,
                title="Python Fundamentals Assessment",
                description="Comprehensive graduation assessment testing variables, operators, loops, conditionals, and functions.",
                quiz_type=QuizType.FINAL,
                passing_score=Decimal("70.00"),
                max_attempts=3,
                time_limit_minutes=30,
            )
            db.add(c1_quiz)
            db.flush()
        else:
            c1_quiz.title = "Python Fundamentals Assessment"
            c1_quiz.description = "Comprehensive graduation assessment testing variables, operators, loops, conditionals, and functions."

        # Ensure questions exist for C1 Quiz
        q_count = db.query(Question).filter(Question.quiz_id == c1_quiz.id).count()
        if q_count == 0:
            # Q1: MCQ
            q1 = Question(
                id=uuid.uuid4(),
                quiz_id=c1_quiz.id,
                question_text="Which built-in Python data type represents an ordered, immutable sequence of characters?",
                question_type=QuestionType.MCQ,
                points=1,
                order_index=1,
            )
            db.add(q1)
            db.flush()
            db.add_all([
                QuestionOption(id=uuid.uuid4(), question_id=q1.id, option_text="str", is_correct=True, order_index=1),
                QuestionOption(id=uuid.uuid4(), question_id=q1.id, option_text="list", is_correct=False, order_index=2),
                QuestionOption(id=uuid.uuid4(), question_id=q1.id, option_text="dict", is_correct=False, order_index=3),
                QuestionOption(id=uuid.uuid4(), question_id=q1.id, option_text="set", is_correct=False, order_index=4),
            ])

            # Q2: TRUE_FALSE
            q2 = Question(
                id=uuid.uuid4(),
                quiz_id=c1_quiz.id,
                question_text="In Python, lists are mutable while tuples are immutable.",
                question_type=QuestionType.TRUE_FALSE,
                points=1,
                order_index=2,
            )
            db.add(q2)
            db.flush()
            db.add_all([
                QuestionOption(id=uuid.uuid4(), question_id=q2.id, option_text="True", is_correct=True, order_index=1),
                QuestionOption(id=uuid.uuid4(), question_id=q2.id, option_text="False", is_correct=False, order_index=2),
            ])

            # Q3: MULTI_SELECT
            q3 = Question(
                id=uuid.uuid4(),
                quiz_id=c1_quiz.id,
                question_text="Which of the following are valid keyword statements for creating loops or control flow in Python?",
                question_type=QuestionType.MULTI_SELECT,
                points=2,
                order_index=3,
            )
            db.add(q3)
            db.flush()
            db.add_all([
                QuestionOption(id=uuid.uuid4(), question_id=q3.id, option_text="for", is_correct=True, order_index=1),
                QuestionOption(id=uuid.uuid4(), question_id=q3.id, option_text="while", is_correct=True, order_index=2),
                QuestionOption(id=uuid.uuid4(), question_id=q3.id, option_text="if", is_correct=True, order_index=3),
                QuestionOption(id=uuid.uuid4(), question_id=q3.id, option_text="loop", is_correct=False, order_index=4),
            ])

        # ==========================================
        # COURSE 2: Finance -> Financial Analysis
        # ==========================================
        fin_domain = db.query(Domain).filter(Domain.slug == "finance").first()
        if not fin_domain:
            fin_domain = Domain(
                id=uuid.uuid4(),
                name="Finance",
                slug="finance",
                description="Corporate finance, accounting principles, investment analysis, and valuation modeling.",
                icon_url="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=200",
            )
            db.add(fin_domain)
            db.flush()
        else:
            fin_domain.name = "Finance"
            fin_domain.description = "Corporate finance, accounting principles, investment analysis, and valuation modeling."

        fin_sub = db.query(SubDomain).filter(SubDomain.slug == "financial-analysis").first()
        if not fin_sub:
            fin_sub = SubDomain(
                id=uuid.uuid4(),
                domain_id=fin_domain.id,
                name="Financial Analysis",
                slug="financial-analysis",
                description="Techniques for evaluating corporate health, profitability, balance sheet strength, and investment returns.",
            )
            db.add(fin_sub)
            db.flush()
        else:
            fin_sub.name = "Financial Analysis"
            fin_sub.domain_id = fin_domain.id

        course2 = db.query(Course).filter(Course.slug == "financial-analysis-fundamentals").first()
        if not course2:
            course2 = Course(
                id=uuid.uuid4(),
                instructor_id=instructor.id,
                sub_domain_id=fin_sub.id,
                title="Financial Analysis Fundamentals",
                slug="financial-analysis-fundamentals",
                description="Master the interpretation of financial statements, corporate cash flow, and essential performance ratios.",
                thumbnail_url="https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600",
                difficulty_level=DifficultyLevel.INTERMEDIATE,
                is_published=True,
            )
            db.add(course2)
            db.flush()
        else:
            course2.title = "Financial Analysis Fundamentals"
            course2.sub_domain_id = fin_sub.id
            course2.description = "Master the interpretation of financial statements, corporate cash flow, and essential performance ratios."
            course2.is_published = True

        # Course 2 - Module 1: Introduction to Financial Statements
        c2_m1 = db.query(Module).filter(Module.course_id == course2.id, Module.order_index == 1).first()
        if not c2_m1:
            c2_m1 = Module(
                id=uuid.uuid4(),
                course_id=course2.id,
                title="Introduction to Financial Statements",
                description="Deconstructing the three core financial statements and their interconnected accounting logic.",
                order_index=1,
                is_required=True,
            )
            db.add(c2_m1)
            db.flush()
        else:
            c2_m1.title = "Introduction to Financial Statements"
            c2_m1.description = "Deconstructing the three core financial statements and their interconnected accounting logic."
            c2_m1.is_required = True

        # C2 M1 Lessons
        c2_m1_lessons_data = [
            (1, "Understanding the Balance Sheet", "Assets, liabilities, and shareholder equity: measuring financial position at a point in time.", "https://example.com/videos/fin-balance-sheet.mp4"),
            (2, "Reading the Income Statement", "Revenue recognition, COGS, operating expenses, and net profit over a financial period.", "https://example.com/videos/fin-income-statement.mp4"),
            (3, "Cash Flow Fundamentals", "Operating, investing, and financing activities: tracking actual liquidity vs accrual profit.", "https://example.com/videos/fin-cash-flow.mp4"),
        ]
        for ord_idx, title, desc, v_url in c2_m1_lessons_data:
            les = db.query(Lesson).filter(Lesson.module_id == c2_m1.id, Lesson.order_index == ord_idx).first()
            if not les:
                les = Lesson(
                    id=uuid.uuid4(),
                    module_id=c2_m1.id,
                    title=title,
                    content_body=desc,
                    video_url=v_url,
                    order_index=ord_idx,
                )
                db.add(les)
            else:
                les.title = title
                les.content_body = desc
                les.video_url = v_url

        # Course 2 - Module 2: Financial Performance Analysis
        c2_m2 = db.query(Module).filter(Module.course_id == course2.id, Module.order_index == 2).first()
        if not c2_m2:
            c2_m2 = Module(
                id=uuid.uuid4(),
                course_id=course2.id,
                title="Financial Performance Analysis",
                description="Quantitative metrics for evaluating operating efficiency, debt solvency, and investor return.",
                order_index=2,
                is_required=True,
            )
            db.add(c2_m2)
            db.flush()
        else:
            c2_m2.title = "Financial Performance Analysis"
            c2_m2.description = "Quantitative metrics for evaluating operating efficiency, debt solvency, and investor return."
            c2_m2.is_required = True

        # C2 M2 Lessons
        c2_m2_lessons_data = [
            (1, "Profitability Ratios", "Analyzing gross margin, operating margin, ROE (Return on Equity), and ROA (Return on Assets).", "https://example.com/videos/fin-profitability.mp4"),
            (2, "Liquidity Ratios", "Evaluating short-term solvency with current ratio, quick ratio (acid-test), and cash ratio.", "https://example.com/videos/fin-liquidity.mp4"),
            (3, "Interpreting Financial Performance", "Synthesizing cross-sectional and time-series trends to formulate executive insights.", "https://example.com/videos/fin-synthesis.mp4"),
        ]
        for ord_idx, title, desc, v_url in c2_m2_lessons_data:
            les = db.query(Lesson).filter(Lesson.module_id == c2_m2.id, Lesson.order_index == ord_idx).first()
            if not les:
                les = Lesson(
                    id=uuid.uuid4(),
                    module_id=c2_m2.id,
                    title=title,
                    content_body=desc,
                    video_url=v_url,
                    order_index=ord_idx,
                )
                db.add(les)
            else:
                les.title = title
                les.content_body = desc
                les.video_url = v_url

        # Course 2 Final Quiz
        c2_quiz = db.query(Quiz).filter(Quiz.course_id == course2.id, Quiz.quiz_type == QuizType.FINAL).first()
        if not c2_quiz:
            c2_quiz = Quiz(
                id=uuid.uuid4(),
                course_id=course2.id,
                title="Financial Analysis Assessment",
                description="Comprehensive assessment covering financial statements, cash flow dynamics, and key financial ratios.",
                quiz_type=QuizType.FINAL,
                passing_score=Decimal("70.00"),
                max_attempts=3,
                time_limit_minutes=30,
            )
            db.add(c2_quiz)
            db.flush()
        else:
            c2_quiz.title = "Financial Analysis Assessment"
            c2_quiz.description = "Comprehensive assessment covering financial statements, cash flow dynamics, and key financial ratios."

        # Ensure questions exist for C2 Quiz
        q2_count = db.query(Question).filter(Question.quiz_id == c2_quiz.id).count()
        if q2_count == 0:
            # Q1: MCQ
            q1 = Question(
                id=uuid.uuid4(),
                quiz_id=c2_quiz.id,
                question_text="Which financial statement reports a company's financial position (assets, liabilities, equity) at a specific date?",
                question_type=QuestionType.MCQ,
                points=1,
                order_index=1,
            )
            db.add(q1)
            db.flush()
            db.add_all([
                QuestionOption(id=uuid.uuid4(), question_id=q1.id, option_text="Balance Sheet", is_correct=True, order_index=1),
                QuestionOption(id=uuid.uuid4(), question_id=q1.id, option_text="Income Statement", is_correct=False, order_index=2),
                QuestionOption(id=uuid.uuid4(), question_id=q1.id, option_text="Cash Flow Statement", is_correct=False, order_index=3),
                QuestionOption(id=uuid.uuid4(), question_id=q1.id, option_text="Statement of Retained Earnings", is_correct=False, order_index=4),
            ])

            # Q2: TRUE_FALSE
            q2 = Question(
                id=uuid.uuid4(),
                quiz_id=c2_quiz.id,
                question_text="Net Working Capital is calculated as Current Assets minus Current Liabilities.",
                question_type=QuestionType.TRUE_FALSE,
                points=1,
                order_index=2,
            )
            db.add(q2)
            db.flush()
            db.add_all([
                QuestionOption(id=uuid.uuid4(), question_id=q2.id, option_text="True", is_correct=True, order_index=1),
                QuestionOption(id=uuid.uuid4(), question_id=q2.id, option_text="False", is_correct=False, order_index=2),
            ])

            # Q3: MULTI_SELECT
            q3 = Question(
                id=uuid.uuid4(),
                quiz_id=c2_quiz.id,
                question_text="Which of the following metrics are categorized as short-term liquidity ratios?",
                question_type=QuestionType.MULTI_SELECT,
                points=2,
                order_index=3,
            )
            db.add(q3)
            db.flush()
            db.add_all([
                QuestionOption(id=uuid.uuid4(), question_id=q3.id, option_text="Current Ratio", is_correct=True, order_index=1),
                QuestionOption(id=uuid.uuid4(), question_id=q3.id, option_text="Quick (Acid-Test) Ratio", is_correct=True, order_index=2),
                QuestionOption(id=uuid.uuid4(), question_id=q3.id, option_text="Debt-to-Equity Ratio", is_correct=False, order_index=3),
                QuestionOption(id=uuid.uuid4(), question_id=q3.id, option_text="Gross Profit Margin", is_correct=False, order_index=4),
            ])

        db.commit()
        print("SUCCESS: Seeded realistic educational content for Course 1 (Technology) and Course 2 (Finance).")

    except Exception as e:
        db.rollback()
        print(f"ERROR seeding realistic curriculum: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_realistic_content()
