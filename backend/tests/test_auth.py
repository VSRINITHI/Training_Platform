import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
import jwt
from jwt import PyJWKClientError
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException, status
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token, decode_token, get_jwks_client
from app.core.dependencies import require_role
from app.core.database import SessionLocal
from app.models.user import User
from app.models.enums import UserRole


# ---------------------------------------------------------------------------
# Test Key Utilities for ES256 / ECC P-256
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def ec_keypair():
    """Generates an ECC SECP256R1 (P-256) key pair for testing ES256 tokens."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    return private_key, public_key


def generate_es256_token(
    private_key,
    subject: str,
    email: str,
    kid: str = "supabase-test-key-1",
    issuer: str = None,
    expires_delta: timedelta = None,
    user_metadata: dict = None,
    app_metadata: dict = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=1))
    iss = issuer if issuer is not None else (settings.jwt_issuer or "https://test.supabase.co/auth/v1")

    payload = {
        "sub": subject,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "iss": iss,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "user_metadata": user_metadata or {},
        "app_metadata": app_metadata or {},
    }
    headers = {
        "alg": "ES256",
        "typ": "JWT",
        "kid": kid,
    }
    return jwt.encode(payload, private_key, algorithm="ES256", headers=headers)


# ---------------------------------------------------------------------------
# ES256 & JWKS Verification Tests
# ---------------------------------------------------------------------------
def test_es256_valid_token_verification(ec_keypair):
    """Verifies that a valid ES256 token signed by an ECC P-256 key is decoded via JWKS."""
    private_key, public_key = ec_keypair
    user_id = str(uuid.uuid4())
    token = generate_es256_token(
        private_key,
        subject=user_id,
        email="es256.user@example.com",
        user_metadata={"full_name": "ES256 Learner"},
    )

    # Mock JWKS client to return the matching public key
    mock_signing_key = MagicMock()
    mock_signing_key.key = public_key
    mock_jwks = MagicMock()
    mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key

    payload = decode_token(token, jwks_client=mock_jwks)
    assert payload["sub"] == user_id
    assert payload["email"] == "es256.user@example.com"
    assert payload["user_metadata"]["full_name"] == "ES256 Learner"


def test_es256_invalid_signature_raises_401(ec_keypair):
    """Verifies that tampering with an ES256 token or verifying with the wrong key raises 401."""
    private_key, _ = ec_keypair
    # Generate a second, different key pair to simulate an invalid/wrong signature
    _, wrong_public_key = ec.generate_private_key(ec.SECP256R1()), ec.generate_private_key(ec.SECP256R1()).public_key()

    token = generate_es256_token(private_key, subject=str(uuid.uuid4()), email="bad.sig@example.com")

    mock_signing_key = MagicMock()
    mock_signing_key.key = wrong_public_key
    mock_jwks = MagicMock()
    mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key

    with pytest.raises(HTTPException) as exc_info:
        decode_token(token, jwks_client=mock_jwks)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "invalid authentication token" in exc_info.value.detail.lower()


def test_es256_expired_token_raises_401(ec_keypair):
    """Verifies that an expired ES256 token is rejected with 401."""
    private_key, public_key = ec_keypair
    expired_token = generate_es256_token(
        private_key,
        subject=str(uuid.uuid4()),
        email="expired@example.com",
        expires_delta=timedelta(seconds=-60),
    )

    mock_signing_key = MagicMock()
    mock_signing_key.key = public_key
    mock_jwks = MagicMock()
    mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key

    with pytest.raises(HTTPException) as exc_info:
        decode_token(expired_token, jwks_client=mock_jwks)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "expired" in exc_info.value.detail.lower()


def test_es256_invalid_issuer_raises_401(ec_keypair):
    """Verifies that an ES256 token from an unexpected issuer is rejected with 401."""
    private_key, public_key = ec_keypair
    token_bad_iss = generate_es256_token(
        private_key,
        subject=str(uuid.uuid4()),
        email="rogue@example.com",
        issuer="https://rogue-supabase.evil.com/auth/v1",
    )

    mock_signing_key = MagicMock()
    mock_signing_key.key = public_key
    mock_jwks = MagicMock()
    mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key

    with pytest.raises(HTTPException) as exc_info:
        decode_token(token_bad_iss, jwks_client=mock_jwks)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "issuer" in exc_info.value.detail.lower()


def test_es256_unknown_kid_raises_401(ec_keypair):
    """Verifies that if the token's kid cannot be found in the JWKS, 401 is returned."""
    private_key, _ = ec_keypair
    token = generate_es256_token(private_key, subject=str(uuid.uuid4()), email="unknown.kid@example.com", kid="unknown-kid")

    mock_jwks = MagicMock()
    mock_jwks.get_signing_key_from_jwt.side_effect = PyJWKClientError("Key not found in JWKS")

    with pytest.raises(HTTPException) as exc_info:
        decode_token(token, jwks_client=mock_jwks)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "invalid token signing key" in exc_info.value.detail.lower()


def test_unsupported_algorithm_raises_401():
    """Verifies that an unsupported or unapproved algorithm (e.g. none) is rejected."""
    token = jwt.encode({"sub": str(uuid.uuid4()), "email": "test@test.com"}, "secret", algorithm="HS512")
    with pytest.raises(HTTPException) as exc_info:
        decode_token(token)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "unsupported token signing algorithm" in exc_info.value.detail.lower()


# ---------------------------------------------------------------------------
# Legacy HS256 Backward Compatibility Tests
# ---------------------------------------------------------------------------
def test_legacy_hs256_token_creation_and_decoding():
    user_id = str(uuid.uuid4())
    email = "test.legacy@example.com"
    token = create_access_token(
        subject=user_id,
        email=email,
        user_metadata={"full_name": "Legacy Learner"},
    )
    payload = decode_token(token)
    assert payload["sub"] == user_id
    assert payload["email"] == email
    assert payload["user_metadata"]["full_name"] == "Legacy Learner"


def test_legacy_hs256_expired_raises_401():
    user_id = str(uuid.uuid4())
    expired_token = create_access_token(
        subject=user_id,
        email="expired.legacy@example.com",
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(HTTPException) as exc_info:
        decode_token(expired_token)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "expired" in exc_info.value.detail.lower()


def test_invalid_token_format_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        decode_token("invalid.jwt.token.string")
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# End-to-End User Sync & Bearer Authentication Tests
# ---------------------------------------------------------------------------
def test_unauthenticated_request_rejected(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


def test_e2e_jwt_authentication_and_user_sync(client: TestClient, ec_keypair):
    """
    End-to-end authentication test with ES256 / ECC token:
    - Simulates Supabase Auth user signup in auth.users
    - Generates a signed ES256 JWT
    - Sends token in Authorization: Bearer header
    - Verifies JWT verification, automatic public.users provisioning, and profile response
    """
    private_key, public_key = ec_keypair
    test_user_id = uuid.uuid4()
    suffix = str(test_user_id)[:8]
    test_email = f"e2e.{suffix}@example.com"

    db = SessionLocal()
    try:
        # 1. Simulate Supabase Auth signup (auth.users entry)
        db.execute(
            text("INSERT INTO auth.users (id, email, aud, role) VALUES (:id, :email, :aud, :role)"),
            {"id": test_user_id, "email": test_email, "aud": "authenticated", "role": "authenticated"},
        )
        db.commit()
    finally:
        db.close()

    token = generate_es256_token(
        private_key,
        subject=str(test_user_id),
        email=test_email,
        user_metadata={"full_name": "E2E ES256 User", "avatar_url": "https://example.com/avatar.png"},
    )

    mock_signing_key = MagicMock()
    mock_signing_key.key = public_key
    mock_jwks = MagicMock()
    mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key

    try:
        with patch("app.core.security.get_jwks_client", return_value=mock_jwks):
            # 2. Real end-to-end request to /auth/me -> triggers automatic public.users profile sync
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["id"] == str(test_user_id)
            assert data["email"] == test_email
            assert data["full_name"] == "E2E ES256 User"
            assert data["role"] == "USER"
            assert data["avatar_url"] == "https://example.com/avatar.png"

            # 3. Verify database persistence in public.users
            db = SessionLocal()
            try:
                persisted = db.query(User).filter(User.id == test_user_id).first()
                assert persisted is not None
                assert persisted.email == test_email
                assert persisted.full_name == "E2E ES256 User"
            finally:
                db.close()

            # 4. Explicit /auth/sync endpoint call with real Bearer token
            sync_res = client.post(
                "/api/v1/auth/sync",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert sync_res.status_code == status.HTTP_200_OK
            assert sync_res.json()["id"] == str(test_user_id)

            # 5. Profile update via PATCH /auth/me with real Bearer token
            patch_res = client.patch(
                "/api/v1/auth/me",
                json={"full_name": "Updated ES256 Name"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert patch_res.status_code == status.HTTP_200_OK
            assert patch_res.json()["full_name"] == "Updated ES256 Name"

    finally:
        # Cleanup test user from public.users and auth.users
        db = SessionLocal()
        try:
            db.execute(text("DELETE FROM public.users WHERE id = :id"), {"id": test_user_id})
            db.execute(text("DELETE FROM auth.users WHERE id = :id"), {"id": test_user_id})
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


# ---------------------------------------------------------------------------
# RBAC Security Tests
# ---------------------------------------------------------------------------
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


def test_jwt_claims_cannot_elevate_database_role(client: TestClient, ec_keypair):
    """
    Verifies that a user cannot elevate their database role by sending an app_metadata/role
    claim in their JWT on subsequent logins.
    """
    private_key, public_key = ec_keypair
    test_user_id = uuid.uuid4()
    suffix = str(test_user_id)[:8]
    test_email = f"learner.{suffix}@example.com"

    db = SessionLocal()
    try:
        # Pre-create user in auth.users and public.users as USER role
        db.execute(
            text("INSERT INTO auth.users (id, email, aud, role) VALUES (:id, :email, :aud, :role)"),
            {"id": test_user_id, "email": test_email, "aud": "authenticated", "role": "authenticated"},
        )
        user = User(
            id=test_user_id,
            email=test_email,
            full_name="Regular Learner",
            role=UserRole.USER,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()

    # User attempts to send a JWT claiming role="ADMIN" in user_metadata or app_metadata
    malicious_token = generate_es256_token(
        private_key,
        subject=str(test_user_id),
        email=test_email,
        user_metadata={"role": "ADMIN"},
        app_metadata={"role": "ADMIN"},
    )

    mock_signing_key = MagicMock()
    mock_signing_key.key = public_key
    mock_jwks = MagicMock()
    mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key

    try:
        with patch("app.core.security.get_jwks_client", return_value=mock_jwks):
            # Access /auth/me -> should still have role USER from database
            res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {malicious_token}"})
            assert res.status_code == status.HTTP_200_OK
            assert res.json()["role"] == "USER"

            # Attempt admin operation -> should be forbidden (403)
            target_id = str(uuid.uuid4())
            admin_res = client.patch(
                f"/api/v1/auth/users/{target_id}/role",
                json={"role": "INSTRUCTOR"},
                headers={"Authorization": f"Bearer {malicious_token}"},
            )
            assert admin_res.status_code == status.HTTP_403_FORBIDDEN
    finally:
        db = SessionLocal()
        try:
            db.execute(text("DELETE FROM public.users WHERE id = :id"), {"id": test_user_id})
            db.execute(text("DELETE FROM auth.users WHERE id = :id"), {"id": test_user_id})
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

