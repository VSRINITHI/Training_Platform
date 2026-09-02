"""
NVIDIA AI Quiz Generation Service.

Communicates with NVIDIA's OpenAI-compatible inference API (default model: meta/llama-3.2-11b-vision-instruct)
to generate pedagogically sound, structured quiz questions for lessons, modules, and courses.

Enforces:
1. Strict content grounding (Lesson text -> Extracted document text -> Video transcript).
2. Intelligent prompt cleaning and context size control (no binary or base64 data sent to LLM).
3. 90-second HTTP timeout with transient error retry strategy (max 2 attempts).
4. Strict JSON schema validation via Pydantic and quarantined AI draft creation (PENDING_REVIEW).
"""
import io
import os
import re
import json
import time
import logging
from typing import List, Optional, Dict, Any, Tuple
import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.quiz import GeneratedQuizPayload, GeneratedQuestion, GeneratedQuestionOption

logger = logging.getLogger(__name__)


def extract_text_from_document(document_url: Optional[str]) -> Optional[str]:
    """
    Safely retrieves and extracts plain text from an uploaded lesson document (PDF, TXT, MD).
    Never sends binary/base64 data to the LLM.
    Returns cleaned text or None if extraction is not possible.
    """
    if not document_url:
        return None

    try:
        raw_bytes: Optional[bytes] = None

        # Check if local static storage path
        if "/static/uploads/" in document_url:
            rel_path = document_url.split("/static/uploads/")[1]
            local_path = os.path.join(settings.STATIC_DIR, rel_path.replace("/", os.sep))
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    raw_bytes = f.read()

        # If not found locally and is HTTP URL, fetch with a short 10s timeout
        if not raw_bytes and document_url.startswith("http"):
            with httpx.Client(timeout=10.0) as client:
                res = client.get(document_url)
                if res.status_code == 200:
                    raw_bytes = res.content

        if not raw_bytes:
            return None

        # Determine file type
        clean_url = document_url.lower().split("?")[0]
        extracted_text = ""

        if clean_url.endswith(".pdf"):
            try:
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
                # Extract up to first 5 pages to keep context focused
                pages_text = []
                for i in range(min(5, len(reader.pages))):
                    page_text = reader.pages[i].extract_text()
                    if page_text:
                        pages_text.append(page_text.strip())
                extracted_text = "\n\n".join(pages_text)
            except Exception as pdf_err:
                logger.warning(f"Could not extract PDF text from {document_url}: {pdf_err}")
                return None
        elif clean_url.endswith((".txt", ".md", ".csv", ".json")):
            try:
                extracted_text = raw_bytes.decode("utf-8", errors="ignore")
            except Exception:
                return None
        else:
            # Unsupported document format for text extraction
            return None

        # Normalize whitespace and truncate to max 3000 chars
        normalized = re.sub(r"\s+", " ", extracted_text).strip()
        return normalized[:3000] if normalized else None

    except Exception as e:
        logger.warning(f"Document text extraction failed for {document_url}: {e}")
        return None


def _extract_json_from_text(raw_text: str) -> Any:
    """
    Extracts and parses JSON from raw LLM output, handling markdown code fences,
    extraneous commentary, trailing commas, and pythonic boolean/null representations.
    """
    cleaned = raw_text.strip()

    # 1. Check for markdown code blocks (```json ... ``` or ``` ...)
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if code_block_match:
        cleaned = code_block_match.group(1).strip()

    # 2. If text starts before the first '{' or '[', slice from first bracket
    first_brace = cleaned.find("{")
    first_bracket = cleaned.find("[")
    if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
        last_brace = cleaned.rfind("}")
        if last_brace != -1:
            cleaned = cleaned[first_brace : last_brace + 1]
    elif first_bracket != -1:
        last_bracket = cleaned.rfind("]")
        if last_bracket != -1:
            cleaned = cleaned[first_bracket : last_bracket + 1]

    # 3. Clean up common JSON syntax anomalies
    cleaned = re.sub(r",\s*([\]}])", r"\1", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning(f"Initial JSON parse failed: {e}. Attempting basic sanitization.")
        # Replace unquoted true/false/null if capitalized like Python
        repaired = re.sub(r"\bTrue\b", "true", cleaned)
        repaired = re.sub(r"\bFalse\b", "false", repaired)
        repaired = re.sub(r"\bNone\b", "null", repaired)
        try:
            return json.loads(repaired)
        except Exception as second_e:
            raise ValueError(f"Could not parse valid JSON from AI response: {str(second_e)}")


def parse_and_validate_quiz_payload(raw_data: Any) -> GeneratedQuizPayload:
    """
    Normalizes and validates raw LLM JSON into a typed GeneratedQuizPayload.
    """
    if isinstance(raw_data, str):
        parsed = _extract_json_from_text(raw_data)
    elif isinstance(raw_data, (dict, list)):
        parsed = raw_data
    else:
        raise ValueError(f"Unexpected raw data type from LLM: {type(raw_data)}")

    # Standardize list format vs dict format
    if isinstance(parsed, list):
        parsed_dict = {"questions": parsed}
    elif isinstance(parsed, dict):
        if "questions" in parsed and isinstance(parsed["questions"], list):
            parsed_dict = parsed
        elif "quiz" in parsed and isinstance(parsed["quiz"], dict) and "questions" in parsed["quiz"]:
            parsed_dict = {"questions": parsed["quiz"]["questions"]}
        elif "items" in parsed and isinstance(parsed["items"], list):
            parsed_dict = {"questions": parsed["items"]}
        else:
            # Maybe single question or flat object with questions
            keys_with_list = [k for k, v in parsed.items() if isinstance(v, list)]
            if keys_with_list:
                parsed_dict = {"questions": parsed[keys_with_list[0]]}
            else:
                raise ValueError("JSON object does not contain a 'questions' list.")
    else:
        raise ValueError("JSON root must be an object containing 'questions' or a list of questions.")

    # Validate against Pydantic schema
    try:
        validated = GeneratedQuizPayload.model_validate(parsed_dict)
        return validated
    except Exception as validation_err:
        logger.error(f"Pydantic validation of AI quiz failed: {validation_err}")
        raise ValueError(f"AI response did not match required quiz schema: {validation_err}")


def build_nvidia_prompt(
    course_title: str,
    module_title: Optional[str] = None,
    lesson_titles: Optional[List[str]] = None,
    lesson_content: Optional[str] = None,
    difficulty: str = "INTERMEDIATE",
    num_questions: int = 5,
    question_types: Optional[List[str]] = None,
    custom_instructions: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Constructs the system prompt and grounded user prompt for NVIDIA inference.
    """
    types_str = ", ".join(question_types or ["MCQ", "TRUE_FALSE", "MULTI_SELECT"])

    system_prompt = (
        "You are an expert technical curriculum developer and assessment designer for the DataCaliper Training Platform.\n"
        "Your task is to generate high-quality, rigorous assessment questions based on the provided technical course context.\n"
        "You MUST return ONLY valid JSON matching this exact structure without any conversational preface or markdown formatting:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "question_text": "Clear, precise question statement",\n'
        '      "question_type": "MCQ" | "TRUE_FALSE" | "MULTI_SELECT",\n'
        '      "points": 1,\n'
        '      "explanation": "Detailed explanation of why the correct answer is correct",\n'
        '      "options": [\n'
        '        {"option_text": "Option A text", "is_correct": true},\n'
        '        {"option_text": "Option B text", "is_correct": false},\n'
        '        {"option_text": "Option C text", "is_correct": false},\n'
        '        {"option_text": "Option D text", "is_correct": false}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        "RULES:\n"
        "1. For MCQ and TRUE_FALSE: exactly one option must have is_correct: true.\n"
        "2. For MULTI_SELECT: two or more options must have is_correct: true.\n"
        "3. For TRUE_FALSE: options must be 'True' and 'False'.\n"
        "4. Include comprehensive explanations for each question grounded in the provided lesson material.\n"
        "5. Output valid, parseable JSON only."
    )

    user_prompt_lines = [
        f"Course: {course_title}",
    ]
    if module_title:
        user_prompt_lines.append(f"Module/Chapter: {module_title}")
    if lesson_titles:
        user_prompt_lines.append(f"Included Lessons: {', '.join(lesson_titles)}")
    if lesson_content:
        # Truncate content to 3500 chars to ensure clean grounding within token budget
        clean_content = re.sub(r"\s+", " ", lesson_content).strip()
        user_prompt_lines.append(f"Lesson Learning Content Notes:\n{clean_content[:3500]}")

    user_prompt_lines.append(f"Difficulty: {difficulty}")
    user_prompt_lines.append(f"Number of Questions: {num_questions}")
    user_prompt_lines.append(f"Allowed Question Types: {types_str}")

    if custom_instructions:
        user_prompt_lines.append(f"Special Focus / Instructions: {custom_instructions}")

    user_prompt_lines.append(
        "\nGenerate the questions now. Output strictly JSON with the 'questions' array."
    )

    return system_prompt, "\n".join(user_prompt_lines)


def generate_quiz_questions(
    course_title: str,
    module_title: Optional[str] = None,
    lesson_titles: Optional[List[str]] = None,
    lesson_content: Optional[str] = None,
    difficulty: str = "INTERMEDIATE",
    num_questions: int = 5,
    question_types: Optional[List[str]] = None,
    custom_instructions: Optional[str] = None,
    timeout_seconds: Optional[float] = None,
    max_retries: Optional[int] = None,
) -> Tuple[GeneratedQuizPayload, Dict[str, Any]]:
    """
    Calls NVIDIA's OpenAI-compatible inference endpoint with retry on transient errors,
    parses the structured response, validates the schema, and returns (validated_payload, raw_json_dict).
    """
    api_key = settings.NVIDIA_API_KEY
    if not api_key:
        logger.error("NVIDIA_API_KEY is not configured in the backend environment.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Quiz Generation service is not configured (missing NVIDIA API key).",
        )

    # Clean and check lesson content
    combined_content = (lesson_content or "").strip()
    if len(combined_content) < 50:
        logger.warning("Insufficient lesson content for AI quiz generation.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient lesson learning content to generate quiz questions. Please add lesson text or attach reference materials before generating questions.",
        )

    system_prompt, user_prompt = build_nvidia_prompt(
        course_title=course_title,
        module_title=module_title,
        lesson_titles=lesson_titles,
        lesson_content=combined_content,
        difficulty=difficulty,
        num_questions=num_questions,
        question_types=question_types,
        custom_instructions=custom_instructions,
    )

    base_url = settings.NVIDIA_BASE_URL.rstrip("/")
    endpoint_url = f"{base_url}/chat/completions"
    model_name = settings.NVIDIA_MODEL
    req_timeout = timeout_seconds or getattr(settings, "NVIDIA_TIMEOUT_SECONDS", 90.0)
    total_retries = max_retries or getattr(settings, "NVIDIA_MAX_RETRIES", 2)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Dynamic token allocation based on requested questions
    allocated_tokens = min(4000, max(1500, num_questions * 500))

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": allocated_tokens,
    }

    raw_content: Optional[str] = None
    last_error: Optional[Exception] = None

    for attempt_idx in range(1, total_retries + 1):
        try:
            logger.info(
                f"Calling NVIDIA API (attempt {attempt_idx}/{total_retries}, model: {model_name}, timeout: {req_timeout}s)..."
            )
            with httpx.Client(timeout=req_timeout) as client:
                response = client.post(endpoint_url, headers=headers, json=payload)

                # Fatal non-retryable 4xx errors
                if response.status_code == 401:
                    logger.error("NVIDIA API authentication failed. Invalid API key.")
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="NVIDIA API authentication failed. Please check backend API key configuration.",
                    )
                elif response.status_code == 429:
                    logger.warning("NVIDIA API rate limit exceeded.")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="NVIDIA AI service rate limit reached. Please try again in a few moments.",
                    )
                elif 400 <= response.status_code < 500:
                    logger.error(f"NVIDIA API client error: HTTP {response.status_code} - {response.text[:300]}")
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"NVIDIA AI service returned client error (HTTP {response.status_code}).",
                    )
                elif response.status_code >= 500:
                    logger.warning(f"NVIDIA API server error (attempt {attempt_idx}): HTTP {response.status_code}")
                    if attempt_idx < total_retries:
                        time.sleep(2.0)
                        continue
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="NVIDIA AI generation service is temporarily unavailable. Please try again in a few moments.",
                    )

                res_json = response.json()
                choices = res_json.get("choices", [])
                if not choices:
                    raise ValueError("NVIDIA response contained no choices.")

                raw_content = choices[0].get("message", {}).get("content", "")
                if not raw_content:
                    raise ValueError("NVIDIA response message content was empty.")

                # If successful, break out of retry loop
                break

        except httpx.TimeoutException as timeout_err:
            logger.warning(f"NVIDIA API call timed out on attempt {attempt_idx}/{total_retries}.")
            last_error = timeout_err
            if attempt_idx < total_retries:
                time.sleep(2.0)
                continue
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="AI quiz generation is temporarily unavailable. NVIDIA did not respond within the allowed time. Please try again.",
            )
        except httpx.ConnectError as conn_err:
            logger.warning(f"NVIDIA connection error on attempt {attempt_idx}/{total_retries}: {conn_err}")
            last_error = conn_err
            if attempt_idx < total_retries:
                time.sleep(2.0)
                continue
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not connect to NVIDIA AI inference service. Please check network connectivity.",
            )
        except HTTPException:
            raise
        except Exception as gen_err:
            logger.error(f"Unexpected error during NVIDIA API call: {gen_err}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"NVIDIA AI service communication failure: {str(gen_err)}",
            )

    if not raw_content:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="NVIDIA AI service did not return response content.",
        )

    # Parse and validate response
    try:
        validated_payload = parse_and_validate_quiz_payload(raw_content)
        raw_dict = validated_payload.model_dump(mode="json")
        return validated_payload, raw_dict
    except Exception as parse_err:
        logger.error(f"Failed to parse and validate NVIDIA output: {parse_err}. Raw text: {raw_content[:400]}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"NVIDIA AI generated invalid question format: {str(parse_err)}",
        )
