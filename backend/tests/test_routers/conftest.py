"""
Shared fixtures for router-level tests.

The TestClient triggers the FastAPI lifespan, which:
  1. Calls init_db()  ← uses the monkeypatched DB_PATH
  2. Seeds master_admin / admin / Ahmad accounts
  3. Creates RAGService and calls initialize()
     → with an empty DB, initialize() logs a warning and returns early
       without touching FAISS or OpenAI.

This means router tests run without any network calls and without mocking
the LLM — they just need OPENAI_API_KEY to be set (CI sets sk-test-placeholder,
developers need it in their .env).
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    """TestClient with an isolated temporary database."""
    monkeypatch.setattr("app.database.DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr("app.config.DATA_DIR", tmp_path)
    monkeypatch.setattr("app.ingest.PDFS_DIR", tmp_path / "pdfs")  # keep auto-ingest off real data
    (tmp_path / "pdfs").mkdir(exist_ok=True)

    from app.main import app

    with TestClient(app) as c:
        yield c


# ── Convenience JWT fixtures ───────────────────────────────────────────────────

@pytest.fixture
def admin_token(client):
    """JWT for the seeded 'admin' account (role=admin)."""
    resp = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "Admin@123",
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture
def master_token(client):
    """JWT for the seeded 'master_admin' account (role=master_admin)."""
    resp = client.post("/api/auth/login", json={
        "username": "master_admin",
        "password": "MasterAdmin@123",
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture
def user_token(client):
    """JWT for the seeded 'Ahmad' user account."""
    resp = client.post("/api/user/login", json={
        "username": "Ahmad",
        "password": "Ahmad@123",
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth(token):
    """Shortcut: return Authorization header dict."""
    return {"Authorization": f"Bearer {token}"}
