"""
Supabase Storage Integration & File Management Service.

Manages dedicated buckets:
- lesson-videos: Video lecture assets (MP4, WebM, Ogg, QuickTime)
- lesson-materials: Supplementary documents (PDF, DOC, DOCX, PPT, PPTX, TXT)

Uses backend service-role key securely for bucket management and authenticated uploads.
Provides fallback local storage in development if Supabase Storage is not reachable.
"""
import os
import uuid
import logging
from pathlib import Path
from typing import Optional, Tuple
import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

BUCKET_VIDEOS = "lesson-videos"
BUCKET_MATERIALS = "lesson-materials"

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogg", ".mov", ".m4v"}
ALLOWED_VIDEO_MIMES = {
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "video/x-m4v",
}

ALLOWED_MATERIAL_EXTENSIONS = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt"}
ALLOWED_MATERIAL_MIMES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "application/octet-stream",  # Fallback for some OS file uploads
}

MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024  # 200 MB
MAX_MATERIAL_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


def ensure_storage_buckets() -> None:
    """
    Idempotently ensures that the dedicated storage buckets exist on Supabase.
    """
    supabase_url = settings.SUPABASE_URL
    secret_key = settings.SUPABASE_SECRET_KEY

    if not supabase_url or not secret_key:
        logger.warning("Supabase URL or Secret Key not configured for storage bucket auto-creation.")
        return

    headers = {
        "apikey": secret_key,
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }

    base_url = supabase_url.rstrip("/")
    buckets_url = f"{base_url}/storage/v1/bucket"

    for bucket_name in [BUCKET_VIDEOS, BUCKET_MATERIALS]:
        try:
            with httpx.Client(timeout=10.0) as client:
                # Check if bucket exists
                r = client.get(f"{buckets_url}/{bucket_name}", headers=headers)
                if r.status_code == 404 or r.status_code == 400:
                    # Create public bucket
                    create_payload = {
                        "id": bucket_name,
                        "name": bucket_name,
                        "public": True,
                        "file_size_limit": MAX_VIDEO_SIZE_BYTES if bucket_name == BUCKET_VIDEOS else MAX_MATERIAL_SIZE_BYTES,
                    }
                    cr = client.post(buckets_url, headers=headers, json=create_payload)
                    if cr.status_code in (200, 201):
                        logger.info(f"Created Supabase Storage bucket: '{bucket_name}'")
                    else:
                        logger.warning(f"Could not create bucket '{bucket_name}': {cr.status_code} - {cr.text[:200]}")
        except Exception as e:
            logger.warning(f"Failed checking/creating bucket '{bucket_name}': {e}")


def generate_signed_url(bucket: str, path: str, expires_in: int = 86400) -> Optional[str]:
    """
    Generates a secure, temporary signed URL for objects in private Supabase Storage buckets.
    """
    supabase_url = settings.SUPABASE_URL
    secret_key = settings.SUPABASE_SECRET_KEY
    if not supabase_url or not secret_key:
        return None

    clean_path = path.lstrip("/")
    # If path contains full Supabase storage prefix, extract object name
    if f"/storage/v1/object/public/{bucket}/" in clean_path:
        clean_path = clean_path.split(f"/storage/v1/object/public/{bucket}/")[-1]
    elif f"/storage/v1/object/sign/{bucket}/" in clean_path:
        clean_path = clean_path.split(f"/storage/v1/object/sign/{bucket}/")[-1].split("?")[0]
    elif f"{bucket}/" in clean_path:
        clean_path = clean_path.split(f"{bucket}/")[-1].split("?")[0]

    base_url = supabase_url.rstrip("/")
    sign_endpoint = f"{base_url}/storage/v1/object/sign/{bucket}/{clean_path}"
    headers = {
        "apikey": secret_key,
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.post(sign_endpoint, headers=headers, json={"expiresIn": expires_in})
            if r.status_code in (200, 201):
                signed_path = r.json().get("signedURL", "")
                if signed_path:
                    return f"{base_url}/storage/v1{signed_path}"
    except Exception as e:
        logger.warning(f"Failed generating signed URL for {bucket}/{clean_path}: {e}")

    return None


def resolve_media_url(url_or_path: Optional[str], bucket: str = BUCKET_VIDEOS) -> Optional[str]:
    """
    Resolves a stored media path or public URL into an authorized, accessible URL.
    For private Supabase video buckets, automatically generates a valid signed URL.
    """
    if not url_or_path:
        return None

    # If it's a Supabase storage URL pointing to a private bucket
    if "supabase.co/storage/v1/object" in url_or_path:
        if f"/{BUCKET_VIDEOS}/" in url_or_path:
            filename = url_or_path.split(f"/{BUCKET_VIDEOS}/")[-1].split("?")[0]
            signed = generate_signed_url(BUCKET_VIDEOS, filename)
            if signed:
                return signed

    return url_or_path


def upload_file_to_storage(
    bucket: str,
    file_bytes: bytes,
    original_filename: str,
    content_type: str,
) -> str:
    """
    Uploads a file to Supabase Storage and returns its accessible URL.
    Generates a unique, collision-resistant storage path.
    """
    ext = Path(original_filename).suffix.lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    storage_path = f"{unique_name}"

    supabase_url = settings.SUPABASE_URL
    secret_key = settings.SUPABASE_SECRET_KEY

    if supabase_url and secret_key:
        base_url = supabase_url.rstrip("/")
        upload_url = f"{base_url}/storage/v1/object/{bucket}/{storage_path}"
        headers = {
            "apikey": secret_key,
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": content_type or "application/octet-stream",
            "x-upsert": "true",
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                r = client.post(upload_url, headers=headers, content=file_bytes)
                if r.status_code in (200, 201):
                    if bucket == BUCKET_VIDEOS:
                        signed_url = generate_signed_url(bucket, storage_path)
                        if signed_url:
                            logger.info(f"Successfully uploaded {original_filename} to {signed_url}")
                            return signed_url
                    public_url = f"{base_url}/storage/v1/object/public/{bucket}/{storage_path}"
                    logger.info(f"Successfully uploaded {original_filename} to {public_url}")
                    return public_url
                else:
                    logger.warning(f"Supabase Storage upload failed: {r.status_code} - {r.text[:200]}")
        except Exception as e:
            logger.warning(f"Error during Supabase Storage upload: {e}")

    # Fallback to local uploads directory for development/demo reliability
    local_dir = Path(__file__).resolve().parent.parent.parent / "static" / "uploads" / bucket
    local_dir.mkdir(parents=True, exist_ok=True)
    local_file_path = local_dir / unique_name
    with open(local_file_path, "wb") as f:
        f.write(file_bytes)

    local_url = f"/static/uploads/{bucket}/{unique_name}"
    logger.info(f"Saved locally to {local_url}")
    return local_url
