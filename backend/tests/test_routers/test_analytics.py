"""Tests for GET /api/analytics."""


def test_analytics_returns_structure(client):
    """Response includes every field defined by AnalyticsSummary schema."""
    resp = client.get("/api/analytics")
    assert resp.status_code == 200
    data = resp.json()
    for key in ("total", "cached", "emergency", "avg_ms",
                "doc_count", "chunk_count", "daily_counts",
                "doc_stats", "lang_en_pct", "lang_ar_pct", "avg_sources"):
        assert key in data, f"Missing key: {key}"


def test_analytics_default_period(client):
    """No ?period param → defaults to 30d without error."""
    resp = client.get("/api/analytics")
    assert resp.status_code == 200


def test_analytics_period_7d(client):
    resp = client.get("/api/analytics?period=7d")
    assert resp.status_code == 200


def test_analytics_period_30d(client):
    resp = client.get("/api/analytics?period=30d")
    assert resp.status_code == 200


def test_analytics_period_90d(client):
    resp = client.get("/api/analytics?period=90d")
    assert resp.status_code == 200


def test_analytics_invalid_period(client):
    """Pattern ^(7d|30d|90d)$ — anything else is a 422 validation error."""
    resp = client.get("/api/analytics?period=invalid")
    assert resp.status_code == 422


def test_analytics_fresh_db_zeros(client):
    """Fresh isolated DB → all counters are zero, lists are empty."""
    resp = client.get("/api/analytics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"]     == 0
    assert data["cached"]    == 0
    assert data["emergency"] == 0
    assert data["avg_ms"]    is None
    assert data["doc_count"] == 0
    assert data["chunk_count"] == 0
    assert data["doc_stats"] == []
