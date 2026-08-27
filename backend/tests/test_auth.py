import uuid
from datetime import timedelta
import pytest
from fastapi import HTTPException, status
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token, decode_token
from app.core.dependencies import require_role
from app.models.user import User
from app.models.enums import UserRole


def test_token_creation_and_decoding():
    user_id = str(uuid.uuid4())
    email = "test.learner@example.com"
    token = create_access_token(
        subject=user_id,
        email=email,
        user_metadata={"full_name": "Test Learner"},
    )
    payload = decode_token(token)
    assert payload["sub"] == user_id
    assert payload["email"] == email
    assert payload["user_metadata"]["full_name"] == "Test Learner"


def test_expired_token_raises_401():
    user_id = str(uuid.uuid4())
    expired_token = create_access_token(
        subject=user_id,
        email="expired@example.com",
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(HTTPException) as exc_info:
        decode_token(expired_token)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "expired" in exc_info.value.detail.lower()


def test_invalid_token_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        decode_token("invalid.jwt.token.string")
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


def test_require_role_admin_allows_admin():
    admin_user = User(
        id=uuid.uuid4(),
        email="admin@example.com",
        full_name="Admin User",
        role=UserRole.ADMIN,
    )
    checker = require_role(UserRole.ADMIN)
    result = checker(current_user=admin_user)
    assert result.role == UserRole.ADMIN


def test_require_role_admin_blocks_regular_user():
    regular_user = User(
        id=uuid.uuid4(),
        email="user@example.com",
        full_name="Regular User",
        role=UserRole.USER,
    )
    checker = require_role(UserRole.ADMIN)
    with pytest.raises(HTTPException) as exc_info:
        checker(current_user=regular_user)
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "requires one of the following roles" in exc_info.value.detail


def test_require_role_instructor_or_admin():
    instructor_user = User(
        id=uuid.uuid4(),
        email="instructor@example.com",
        full_name="Instructor User",
        role=UserRole.INSTRUCTOR,
    )
    checker = require_role(UserRole.ADMIN, UserRole.INSTRUCTOR)
    result = checker(current_user=instructor_user)
    assert result.role == UserRole.INSTRUCTOR


def test_unauthenticated_request_rejected(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED or response.status_code == status.HTTP_403_FORBIDDEN


def test_auth_me_endpoint_with_mocked_user(client: TestClient):
    from app.core.dependencies import get_current_user
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    test_user = User(
        id=uuid.uuid4(),
        email="mocked@example.com",
        full_name="Mocked User",
        role=UserRole.USER,
        created_at=now,
        updated_at=now,
    )
    app.dependency_overrides[get_current_user] = lambda: test_user
    try:
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer mock-token"},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == "mocked@example.com"
        assert data["full_name"] == "Mocked User"
        assert data["role"] == "USER"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_admin_role_endpoint_protection(client: TestClient):
    from app.core.dependencies import get_current_user
    regular_user = User(
        id=uuid.uuid4(),
        email="learner@example.com",
        full_name="Learner",
        role=UserRole.USER,
    )
    app.dependency_overrides[get_current_user] = lambda: regular_user
    try:
        # A non-admin user trying to access admin role endpoint gets 403
        target_id = str(uuid.uuid4())
        response = client.patch(
            f"/api/v1/auth/users/{target_id}/role",
            json={"role": "INSTRUCTOR"},
            headers={"Authorization": "Bearer mock-token"},
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
    finally:
        app.dependency_overrides.pop(get_current_user, None)
