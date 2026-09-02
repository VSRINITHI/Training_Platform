"""
Tests for file uploads API (lesson videos and study materials).
"""
import io
import pytest
from app.models.enums import UserRole
from app.core.security import create_access_token


def test_upload_video_as_instructor(client, create_test_user):
    instructor = create_test_user(role=UserRole.INSTRUCTOR, full_name="Instructor Media")
    token = create_access_token(instructor.id, instructor.email)
    headers = {"Authorization": f"Bearer {token}"}

    dummy_video_bytes = b"\x00\x00\x00 ftypisom\x00\x00\x02\x00isomiso2avc1mp41" + (b"\x00" * 1024)
    file_payload = {"file": ("lecture_sample.mp4", io.BytesIO(dummy_video_bytes), "video/mp4")}

    r = client.post("/api/v1/uploads/video", files=file_payload, headers=headers)
    assert r.status_code == 201
    data = r.json()
    assert "url" in data
    assert data["filename"] == "lecture_sample.mp4"
    assert data["content_type"] == "video/mp4"
    assert data["size_bytes"] == len(dummy_video_bytes)


def test_upload_material_as_instructor(client, create_test_user):
    instructor = create_test_user(role=UserRole.INSTRUCTOR, full_name="Instructor Doc")
    token = create_access_token(instructor.id, instructor.email)
    headers = {"Authorization": f"Bearer {token}"}

    dummy_pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    file_payload = {"file": ("notes.pdf", io.BytesIO(dummy_pdf_bytes), "application/pdf")}

    r = client.post("/api/v1/uploads/material", files=file_payload, headers=headers)
    assert r.status_code == 201
    data = r.json()
    assert "url" in data
    assert data["filename"] == "notes.pdf"
    assert data["content_type"] == "application/pdf"


def test_upload_rejected_for_normal_learner(client, create_test_user):
    learner = create_test_user(role=UserRole.USER, full_name="Learner Student")
    token = create_access_token(learner.id, learner.email)
    headers = {"Authorization": f"Bearer {token}"}

    dummy_pdf_bytes = b"%PDF-1.4"
    file_payload = {"file": ("notes.pdf", io.BytesIO(dummy_pdf_bytes), "application/pdf")}

    r = client.post("/api/v1/uploads/material", files=file_payload, headers=headers)
    assert r.status_code == 403


def test_upload_invalid_extension_rejected(client, create_test_user):
    instructor = create_test_user(role=UserRole.INSTRUCTOR, full_name="Instructor Doc")
    token = create_access_token(instructor.id, instructor.email)
    headers = {"Authorization": f"Bearer {token}"}

    dummy_exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00"
    file_payload = {"file": ("malicious.exe", io.BytesIO(dummy_exe_bytes), "application/x-msdownload")}

    r = client.post("/api/v1/uploads/material", files=file_payload, headers=headers)
    assert r.status_code == 400
    assert "invalid document format" in r.json()["detail"].lower()
