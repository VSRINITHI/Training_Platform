"""
File Upload API Endpoints.

Handles multipart file uploads for lesson videos and learning materials.
Enforces instructor/admin authorization, MIME type checks, and maximum file size constraints.
"""
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from app.core.dependencies import require_role
from app.models.user import User
from app.models.enums import UserRole
from app.core.storage import (
    BUCKET_VIDEOS,
    BUCKET_MATERIALS,
    ALLOWED_VIDEO_EXTENSIONS,
    ALLOWED_VIDEO_MIMES,
    ALLOWED_MATERIAL_EXTENSIONS,
    ALLOWED_MATERIAL_MIMES,
    MAX_VIDEO_SIZE_BYTES,
    MAX_MATERIAL_SIZE_BYTES,
    upload_file_to_storage,
)

router = APIRouter(prefix="/uploads", tags=["File Uploads"])


class UploadResponse(BaseModel):
    url: str
    filename: str
    content_type: str
    size_bytes: int


@router.post(
    "/video",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload lesson lecture video (Instructor / Admin)",
)
async def upload_video(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
) -> UploadResponse:
    """
    Uploads a video lecture to the 'lesson-videos' Supabase Storage bucket.
    Accepts MP4, WebM, Ogg, QuickTime. Max size: 200 MB.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS and file.content_type not in ALLOWED_VIDEO_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid video file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}",
        )

    content = await file.read()
    size = len(content)

    if size > MAX_VIDEO_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Video file size exceeds maximum limit of {MAX_VIDEO_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    if size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded video file is empty.",
        )

    public_url = upload_file_to_storage(
        bucket=BUCKET_VIDEOS,
        file_bytes=content,
        original_filename=file.filename or "video.mp4",
        content_type=file.content_type or "video/mp4",
    )

    return UploadResponse(
        url=public_url,
        filename=file.filename or "video.mp4",
        content_type=file.content_type or "video/mp4",
        size_bytes=size,
    )


@router.post(
    "/material",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload lesson document or PDF material (Instructor / Admin)",
)
async def upload_material(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
) -> UploadResponse:
    """
    Uploads a supplementary document to the 'lesson-materials' Supabase Storage bucket.
    Accepts PDF, DOC, DOCX, PPT, PPTX, TXT. Max size: 50 MB.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_MATERIAL_EXTENSIONS and file.content_type not in ALLOWED_MATERIAL_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_MATERIAL_EXTENSIONS))}",
        )

    content = await file.read()
    size = len(content)

    if size > MAX_MATERIAL_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document file size exceeds maximum limit of {MAX_MATERIAL_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    if size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded document file is empty.",
        )

    public_url = upload_file_to_storage(
        bucket=BUCKET_MATERIALS,
        file_bytes=content,
        original_filename=file.filename or "document.pdf",
        content_type=file.content_type or "application/pdf",
    )

    return UploadResponse(
        url=public_url,
        filename=file.filename or "document.pdf",
        content_type=file.content_type or "application/pdf",
        size_bytes=size,
    )
