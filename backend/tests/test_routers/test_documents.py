"""Tests for /api/documents/* endpoints."""

import io
from tests.test_routers.conftest import auth


def test_list_documents_empty(client, admin_token):
    """Fresh DB returns an empty list."""
    resp = client.get("/api/documents", headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_documents_requires_auth(client):
    """No token → 401."""
    resp = client.get("/api/documents")
    assert resp.status_code == 401


def test_rebuild_requires_auth(client):
    """POST /rebuild without token → 401."""
    resp = client.post("/api/documents/rebuild")
    assert resp.status_code == 401


def test_rebuild_with_admin_token(client, admin_token):
    """Admin token → rebuild succeeds (empty index is valid)."""
    resp = client.post("/api/documents/rebuild", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "doc_count" in data
    assert "chunk_count" in data


def test_upload_requires_auth(client):
    """POST /upload without token → 401."""
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert resp.status_code == 401


def test_upload_rejects_non_pdf_extension(client, admin_token):
    """File with .txt extension → rejected before any embedding call."""
    resp = client.post(
        "/api/documents/upload",
        headers=auth(admin_token),
        files={"file": ("report.txt", b"some text content", "text/plain")},
    )
    assert resp.status_code == 200          # endpoint returns 200 with success=False
    data = resp.json()
    assert data["success"] is False
    assert "PDF" in data["message"]


def test_upload_rejects_fake_pdf(client, admin_token):
    """File with .pdf extension but wrong magic bytes → rejected."""
    resp = client.post(
        "/api/documents/upload",
        headers=auth(admin_token),
        files={"file": ("fake.pdf", b"NOTAPDF content here", "application/pdf")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "PDF" in data["message"]


def test_delete_nonexistent_document(client, admin_token):
    """Deleting an ID that doesn't exist → 404."""
    resp = client.delete("/api/documents/99999", headers=auth(admin_token))
    assert resp.status_code == 404


def test_delete_requires_auth(client):
    """DELETE without token → 401."""
    resp = client.delete("/api/documents/1")
    assert resp.status_code == 401
