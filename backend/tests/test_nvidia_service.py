"""
Unit and integration tests for NVIDIA AI Quiz Generation Service.
Tests JSON sanitization, markdown fence extraction, schema validation, timeout handling, retries, and document extraction.
"""
import pytest
import httpx
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.services.nvidia_service import (
    _extract_json_from_text,
    parse_and_validate_quiz_payload,
    build_nvidia_prompt,
    generate_quiz_questions,
    extract_text_from_document,
)
from app.models.enums import QuestionType


def test_extract_json_from_markdown_fences():
    raw_markdown = """Here are the generated questions:
```json
{
  "questions": [
    {
      "question_text": "What is Python?",
      "question_type": "MCQ",
      "points": 1,
      "explanation": "Python is interpreted.",
      "options": [
        {"option_text": "An interpreted language", "is_correct": true},
        {"option_text": "A snake only", "is_correct": false}
      ]
    }
  ]
}
```
Hope this helps!"""

    extracted = _extract_json_from_text(raw_markdown)
    assert isinstance(extracted, dict)
    assert "questions" in extracted
    assert len(extracted["questions"]) == 1


def test_extract_json_with_trailing_commas():
    raw_with_trailing = """
    {
      "questions": [
        {
          "question_text": "Which statement is true?",
          "question_type": "TRUE_FALSE",
          "points": 1,
          "options": [
            {"option_text": "True", "is_correct": true,},
            {"option_text": "False", "is_correct": false,}
          ],
        },
      ],
    }
    """
    extracted = _extract_json_from_text(raw_with_trailing)
    assert "questions" in extracted


def test_parse_and_validate_quiz_payload_success():
    raw_payload = {
        "questions": [
            {
                "question_text": "What are mutable types in Python?",
                "question_type": "MULTI_SELECT",
                "points": 2,
                "explanation": "Lists and dictionaries are mutable.",
                "options": [
                  {"option_text": "list", "is_correct": True},
                  {"option_text": "dict", "is_correct": True},
                  {"option_text": "tuple", "is_correct": False},
                ]
            }
        ]
    }
    validated = parse_and_validate_quiz_payload(raw_payload)
    assert len(validated.questions) == 1
    q = validated.questions[0]
    assert q.question_type == QuestionType.MULTI_SELECT
    assert q.points == 2
    assert len(q.options) == 3


def test_parse_and_validate_quiz_payload_rejects_empty_options():
    invalid_payload = {
        "questions": [
            {
                "question_text": "Invalid Question?",
                "question_type": "MCQ",
                "points": 1,
                "options": []
            }
        ]
    }
    with pytest.raises(ValueError):
        parse_and_validate_quiz_payload(invalid_payload)


def test_parse_and_validate_quiz_payload_rejects_no_correct_answers():
    invalid_payload = {
        "questions": [
            {
                "question_text": "No correct answer here?",
                "question_type": "MCQ",
                "points": 1,
                "options": [
                    {"option_text": "A", "is_correct": False},
                    {"option_text": "B", "is_correct": False},
                ]
            }
        ]
    }
    with pytest.raises(ValueError):
        parse_and_validate_quiz_payload(invalid_payload)


def test_build_nvidia_prompt():
    sys_prompt, user_prompt = build_nvidia_prompt(
        course_title="Python Fundamentals",
        module_title="Control Flow",
        lesson_titles=["If Statements", "Loops"],
        lesson_content="Loops allow repeating blocks of code multiple times based on condition.",
        difficulty="INTERMEDIATE",
        num_questions=5,
    )
    assert "Python Fundamentals" in user_prompt
    assert "Control Flow" in user_prompt
    assert "Loops allow repeating" in user_prompt
    assert "INTERMEDIATE" in user_prompt


@patch("app.services.nvidia_service.httpx.Client")
@patch("app.services.nvidia_service.settings")
def test_generate_quiz_questions_mocked_success(mock_settings, mock_client_cls):
    mock_settings.NVIDIA_API_KEY = "nvapi-test-key"
    mock_settings.NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
    mock_settings.NVIDIA_MODEL = "meta/llama-3.2-11b-vision-instruct"
    mock_settings.NVIDIA_TIMEOUT_SECONDS = 90.0
    mock_settings.NVIDIA_MAX_RETRIES = 2

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": '{"questions": [{"question_text": "What does len() do?", "question_type": "MCQ", "points": 1, "explanation": "Returns length of sequence.", "options": [{"option_text": "Returns length", "is_correct": true}, {"option_text": "Throws error", "is_correct": false}]}]}'
                }
            }
        ]
    }

    mock_client = MagicMock()
    mock_client.post.return_value = mock_resp
    mock_client_cls.return_value.__enter__.return_value = mock_client

    payload, raw_dict = generate_quiz_questions(
        course_title="Python Test",
        lesson_titles=["Builtin Functions"],
        lesson_content="Python provides builtin functions like len(), sum(), max(), and min() for collections.",
        num_questions=1,
    )

    assert len(payload.questions) == 1
    assert payload.questions[0].question_text == "What does len() do?"
    assert payload.questions[0].options[0].is_correct is True


@patch("app.services.nvidia_service.settings")
def test_generate_quiz_questions_insufficient_content_raises_400(mock_settings):
    mock_settings.NVIDIA_API_KEY = "nvapi-test-key"
    with pytest.raises(HTTPException) as exc_info:
        generate_quiz_questions(
            course_title="Test Course",
            lesson_content="Too short",
        )
    assert exc_info.value.status_code == 400
    assert "Insufficient lesson learning content" in exc_info.value.detail


@patch("app.services.nvidia_service.httpx.Client")
@patch("app.services.nvidia_service.settings")
def test_generate_quiz_questions_retry_on_transient_failure(mock_settings, mock_client_cls):
    mock_settings.NVIDIA_API_KEY = "nvapi-test-key"
    mock_settings.NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
    mock_settings.NVIDIA_MODEL = "meta/llama-3.2-11b-vision-instruct"
    mock_settings.NVIDIA_TIMEOUT_SECONDS = 90.0
    mock_settings.NVIDIA_MAX_RETRIES = 2

    mock_fail_resp = MagicMock()
    mock_fail_resp.status_code = 503

    mock_success_resp = MagicMock()
    mock_success_resp.status_code = 200
    mock_success_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": '{"questions": [{"question_text": "Is Python dynamic?", "question_type": "TRUE_FALSE", "points": 1, "explanation": "Python is dynamic.", "options": [{"option_text": "True", "is_correct": true}, {"option_text": "False", "is_correct": false}]}]}'
                }
            }
        ]
    }

    mock_client = MagicMock()
    mock_client.post.side_effect = [mock_fail_resp, mock_success_resp]
    mock_client_cls.return_value.__enter__.return_value = mock_client

    payload, raw_dict = generate_quiz_questions(
        course_title="Python Test",
        lesson_content="Python is dynamically typed and variables can change types during runtime execution.",
        num_questions=1,
    )

    assert len(payload.questions) == 1
    assert payload.questions[0].question_text == "Is Python dynamic?"


@patch("app.services.nvidia_service.httpx.Client")
@patch("app.services.nvidia_service.settings")
def test_generate_quiz_questions_persistent_timeout_raises_504(mock_settings, mock_client_cls):
    mock_settings.NVIDIA_API_KEY = "nvapi-test-key"
    mock_settings.NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
    mock_settings.NVIDIA_MODEL = "meta/llama-3.2-11b-vision-instruct"
    mock_settings.NVIDIA_TIMEOUT_SECONDS = 90.0
    mock_settings.NVIDIA_MAX_RETRIES = 2

    mock_client = MagicMock()
    mock_client.post.side_effect = httpx.TimeoutException("Request timed out")
    mock_client_cls.return_value.__enter__.return_value = mock_client

    with pytest.raises(HTTPException) as exc_info:
        generate_quiz_questions(
            course_title="Python Test",
            lesson_content="Python list comprehensions provide a concise way to create lists from existing iterables.",
            num_questions=1,
        )

    assert exc_info.value.status_code == 504
    assert "NVIDIA did not respond within the allowed time" in exc_info.value.detail


@patch("app.services.nvidia_service.httpx.Client")
@patch("app.services.nvidia_service.settings")
def test_generate_quiz_questions_malformed_json_raises_502(mock_settings, mock_client_cls):
    mock_settings.NVIDIA_API_KEY = "nvapi-test-key"
    mock_settings.NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
    mock_settings.NVIDIA_MODEL = "meta/llama-3.2-11b-vision-instruct"
    mock_settings.NVIDIA_TIMEOUT_SECONDS = 90.0
    mock_settings.NVIDIA_MAX_RETRIES = 1

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "This is not JSON at all."}}]
    }

    mock_client = MagicMock()
    mock_client.post.return_value = mock_resp
    mock_client_cls.return_value.__enter__.return_value = mock_client

    with pytest.raises(HTTPException) as exc_info:
        generate_quiz_questions(
            course_title="Python Test",
            lesson_content="Object-oriented programming in Python uses classes, methods, inheritance, and encapsulation.",
            num_questions=1,
        )

    assert exc_info.value.status_code == 502
    assert "invalid question format" in exc_info.value.detail.lower()
