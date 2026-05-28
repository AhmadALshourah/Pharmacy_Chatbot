"""Tests for GET /api/health."""


def test_health_returns_ok(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "docs" in data
    assert "chunks" in data


def test_health_initial_counts_zero(client):
    """Fresh DB has no documents or chunks yet."""
    resp = client.get("/api/health")
    data = resp.json()
    assert data["docs"] == 0
    assert data["chunks"] == 0
