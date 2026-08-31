import uuid
from datetime import datetime, timezone
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from app.main import app
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.enums import UserRole
from app.core.database import SessionLocal
from app.models.taxonomy import Domain, SubDomain
from app.models.course import Course


@pytest.fixture
def admin_user():
    return User(
        id=uuid.uuid4(),
        email="admin.tax@example.com",
        full_name="Admin Taxonomy",
        role=UserRole.ADMIN,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def regular_user():
    return User(
        id=uuid.uuid4(),
        email="learner.tax@example.com",
        full_name="Learner Taxonomy",
        role=UserRole.USER,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def test_list_domains_public(client: TestClient):
    response = client.get("/api/v1/domains")
    assert response.status_code == status.HTTP_200_OK
    assert isinstance(response.json(), list)


def test_domain_admin_crud(client: TestClient, admin_user, regular_user):
    slug_suffix = str(uuid.uuid4())[:8]
    domain_data = {
        "name": f"Test Domain {slug_suffix}",
        "slug": f"test-domain-{slug_suffix}",
        "description": "Test description for taxonomy",
    }

    # 1. Regular user cannot create domain (403)
    app.dependency_overrides[get_current_user] = lambda: regular_user
    try:
        res = client.post(
            "/api/v1/domains",
            json=domain_data,
            headers={"Authorization": "Bearer token"},
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # 2. Admin user can create domain (201)
    app.dependency_overrides[get_current_user] = lambda: admin_user
    created_domain_id = None
    try:
        res = client.post(
            "/api/v1/domains",
            json=domain_data,
            headers={"Authorization": "Bearer token"},
        )
        assert res.status_code == status.HTTP_201_CREATED
        created_domain_id = res.json()["id"]
        assert res.json()["slug"] == domain_data["slug"]

        # 3. Get domain by slug (Public)
        res_get = client.get(f"/api/v1/domains/{domain_data['slug']}")
        assert res_get.status_code == status.HTTP_200_OK
        assert res_get.json()["id"] == created_domain_id

        # 4. Update domain (Admin)
        res_update = client.patch(
            f"/api/v1/domains/{created_domain_id}",
            json={"description": "Updated domain description"},
            headers={"Authorization": "Bearer token"},
        )
        assert res_update.status_code == status.HTTP_200_OK
        assert res_update.json()["description"] == "Updated domain description"

        # 5. Create a child sub-domain under this domain
        sub_slug = f"test-sub-{slug_suffix}"
        sub_res = client.post(
            "/api/v1/sub-domains",
            json={
                "domain_id": created_domain_id,
                "name": f"Sub Domain {slug_suffix}",
                "slug": sub_slug,
            },
            headers={"Authorization": "Bearer token"},
        )
        assert sub_res.status_code == status.HTTP_201_CREATED
        created_sub_id = sub_res.json()["id"]

        # 6. Delete domain with existing sub-domain fails (RESTRICT rule)
        res_del_fail = client.delete(
            f"/api/v1/domains/{created_domain_id}",
            headers={"Authorization": "Bearer token"},
        )
        assert res_del_fail.status_code == status.HTTP_400_BAD_REQUEST

        # 7. Delete child sub-domain first
        res_del_sub = client.delete(
            f"/api/v1/sub-domains/{created_sub_id}",
            headers={"Authorization": "Bearer token"},
        )
        assert res_del_sub.status_code == status.HTTP_200_OK

        # 8. Now delete parent domain succeeds
        res_del = client.delete(
            f"/api/v1/domains/{created_domain_id}",
            headers={"Authorization": "Bearer token"},
        )
        assert res_del.status_code == status.HTTP_200_OK
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        # Cleanup in DB if anything left
        if created_domain_id:
            db = SessionLocal()
            try:
                db.query(SubDomain).filter(SubDomain.domain_id == uuid.UUID(created_domain_id)).delete()
                db.query(Domain).filter(Domain.id == uuid.UUID(created_domain_id)).delete()
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()


def test_discovery_endpoints(client: TestClient):
    # Public taxonomy tree
    res_tax = client.get("/api/v1/discovery/taxonomy")
    assert res_tax.status_code == status.HTTP_200_OK
    assert isinstance(res_tax.json(), list)

    # Public course discovery
    res_disc = client.get("/api/v1/discovery/courses")
    assert res_disc.status_code == status.HTTP_200_OK
    data = res_disc.json()
    assert "is_personalized" in data
    assert "matched_courses" in data
    assert "total_matches" in data


def test_user_interests_api(client: TestClient, regular_user):
    app.dependency_overrides[get_current_user] = lambda: regular_user
    try:
        # 1. Unauthenticated gets 401/403 when not overridden
        pass
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Unauthenticated request
    res_unauth = client.get("/api/v1/interests/me")
    assert res_unauth.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    # Authenticated get interests
    app.dependency_overrides[get_current_user] = lambda: regular_user
    try:
        res = client.get(
            "/api/v1/interests/me",
            headers={"Authorization": "Bearer mock-token"},
        )
        assert res.status_code == status.HTTP_200_OK
        assert isinstance(res.json(), list)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
