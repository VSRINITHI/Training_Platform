import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.enums import UserRole


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def create_test_user():
    """
    Factory fixture to create an authenticated test user in auth.users and public.users,
    and automatically clean up on test completion.
    """
    created_ids = []

    def _create(role: UserRole = UserRole.USER, full_name: str = "Test User") -> User:
        user_id = uuid.uuid4()
        suffix = str(user_id)[:8]
        email = f"user.{suffix}@test.datacaliper.com"

        db = SessionLocal()
        try:
            db.execute(
                text("INSERT INTO auth.users (id, email, aud, role) VALUES (:id, :email, :aud, :role)"),
                {"id": user_id, "email": email, "aud": "authenticated", "role": "authenticated"},
            )
            user = User(
                id=user_id,
                email=email,
                full_name=full_name,
                role=role,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            created_ids.append(user_id)
            return user
        finally:
            db.close()

    yield _create

    # Cleanup created users
    db = SessionLocal()
    try:
        for uid in created_ids:
            db.execute(text("DELETE FROM public.users WHERE id = :id"), {"id": uid})
            db.execute(text("DELETE FROM auth.users WHERE id = :id"), {"id": uid})
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
