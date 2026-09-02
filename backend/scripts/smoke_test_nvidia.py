"""
Live smoke test script for NVIDIA AI Quiz Generation service.
Runs a real API request against NVIDIA's NIM endpoint using the configured NVIDIA_API_KEY.
"""
import sys
import os

# Ensure UTF-8 stdout
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.services.nvidia_service import generate_quiz_questions


def main():
    print("=" * 60)
    print("NVIDIA AI (Llama 3.1 8B) Live Smoke Test")
    print("=" * 60)
    print(f"Base URL: {settings.NVIDIA_BASE_URL}")
    print(f"Model:    {settings.NVIDIA_MODEL}")
    has_key = bool(settings.NVIDIA_API_KEY)
    print(f"API Key Configured: {'[YES - Configured]' if has_key else '[NO - Missing]'}")

    if not has_key:
        print("ERROR: NVIDIA_API_KEY is not set.")
        sys.exit(1)

    print("\nSending live quiz generation request to NVIDIA NIM...")
    try:
        payload, raw_dict = generate_quiz_questions(
            course_title="Python Programming Fundamentals",
            module_title="Control Flow & Functions",
            lesson_titles=["Loops and Iteration", "Function Arguments"],
            lesson_content="Loops allow repetition. In Python, for-loops iterate over sequences. Functions are defined with def.",
            difficulty="INTERMEDIATE",
            num_questions=3,
            question_types=["MCQ", "TRUE_FALSE", "MULTI_SELECT"],
            custom_instructions="Ensure clear, educational explanations.",
            timeout_seconds=60.0,
        )

        print("\n[SUCCESS] Received & Validated Structured Quiz Payload from NVIDIA!")
        print(f"Generated Questions Count: {len(payload.questions)}")
        for idx, q in enumerate(payload.questions, 1):
            print(f"\n--- Question {idx} ({q.question_type.value}, {q.points} pt) ---")
            print(f"Text: {q.question_text}")
            print("Options:")
            for opt in q.options:
                flag = "[CORRECT]" if opt.is_correct else "[ FALSE ]"
                print(f"  {flag} {opt.option_text}")
            if q.explanation:
                print(f"Explanation: {q.explanation}")

        print("\n" + "=" * 60)
        print("LIVE NVIDIA NIM SMOKE TEST: PASSED")
        print("=" * 60)
        return 0

    except Exception as e:
        print(f"\n[FAILURE] NVIDIA API live test failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
