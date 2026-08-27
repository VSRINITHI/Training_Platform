from fastapi import status


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "message" in data
    assert "docs" in data
    assert "health" in data


def test_health_endpoint_root(client):
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "database" in data
    assert data["database"]["connected"] is True


def test_health_endpoint_v1(client):
    response = client.get("/api/v1/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"]["connected"] is True
    assert data["database"]["message"] == "Database connection successful"
