"""
Router-level tests for /api/auth/* and /api/user/*

Tests cover: login (success + failure), /me, admin CRUD (create, list,
delete, toggle), change-password, and user login.
"""
from .conftest import auth


# ── Admin login ───────────────────────────────────────────────────────────────

def test_admin_login_success(client):
    resp = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "Admin@123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["admin"]["username"] == "admin"
    assert data["admin"]["role"] == "admin"


def test_admin_login_wrong_password(client):
    resp = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


def test_admin_login_unknown_user(client):
    resp = client.post("/api/auth/login", json={
        "username": "nobody",
        "password": "irrelevant",
    })
    assert resp.status_code == 401


def test_master_admin_login(client):
    resp = client.post("/api/auth/login", json={
        "username": "master_admin",
        "password": "MasterAdmin@123",
    })
    assert resp.status_code == 200
    assert resp.json()["admin"]["role"] == "master_admin"


# ── /me ───────────────────────────────────────────────────────────────────────

def test_get_me_returns_profile(client, admin_token):
    resp = client.get("/api/auth/me", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert "password_hash" not in data


def test_get_me_requires_auth(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code in (401, 403)   # no token → unauthenticated


def test_get_me_rejects_user_token(client, user_token):
    """User JWT must not grant access to admin /me."""
    resp = client.get("/api/auth/me", headers=auth(user_token))
    assert resp.status_code == 403


# ── Admin management (Master Admin only) ──────────────────────────────────────

def test_list_admins_as_master(client, master_token):
    resp = client.get("/api/auth/admins", headers=auth(master_token))
    assert resp.status_code == 200
    usernames = [a["username"] for a in resp.json()]
    assert "master_admin" in usernames
    assert "admin" in usernames


def test_list_admins_forbidden_for_regular_admin(client, admin_token):
    resp = client.get("/api/auth/admins", headers=auth(admin_token))
    assert resp.status_code == 403


def test_create_admin(client, master_token):
    resp = client.post(
        "/api/auth/admins",
        json={"username": "newuser", "email": "new@test.com", "password": "NewPass@123"},
        headers=auth(master_token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "newuser"
    assert data["role"] == "admin"
    assert "password_hash" not in data


def test_create_admin_duplicate_username(client, master_token):
    client.post(
        "/api/auth/admins",
        json={"username": "dup", "email": "dup@test.com", "password": "DupPass@123"},
        headers=auth(master_token),
    )
    resp = client.post(
        "/api/auth/admins",
        json={"username": "dup", "email": "dup2@test.com", "password": "DupPass@123"},
        headers=auth(master_token),
    )
    assert resp.status_code == 409


def test_create_admin_forbidden_for_regular_admin(client, admin_token):
    resp = client.post(
        "/api/auth/admins",
        json={"username": "x", "email": "x@test.com", "password": "XPass@123"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 403


def test_delete_admin(client, master_token):
    # Create an admin to delete
    create_resp = client.post(
        "/api/auth/admins",
        json={"username": "todelete", "email": "del@test.com", "password": "DelPass@123"},
        headers=auth(master_token),
    )
    admin_id = create_resp.json()["id"]

    resp = client.delete(f"/api/auth/admins/{admin_id}", headers=auth(master_token))
    assert resp.status_code == 204


def test_delete_admin_cannot_delete_self(client, master_token):
    me = client.get("/api/auth/me", headers=auth(master_token)).json()
    resp = client.delete(f"/api/auth/admins/{me['id']}", headers=auth(master_token))
    assert resp.status_code == 400


def test_toggle_admin_active(client, master_token):
    # Create admin to toggle
    created = client.post(
        "/api/auth/admins",
        json={"username": "toggler", "email": "tog@test.com", "password": "TogPass@123"},
        headers=auth(master_token),
    ).json()
    admin_id = created["id"]
    assert created["is_active"] is True

    # Deactivate
    resp = client.patch(f"/api/auth/admins/{admin_id}/toggle", headers=auth(master_token))
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Reactivate
    resp = client.patch(f"/api/auth/admins/{admin_id}/toggle", headers=auth(master_token))
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


def test_toggle_cannot_deactivate_self(client, master_token):
    me = client.get("/api/auth/me", headers=auth(master_token)).json()
    resp = client.patch(f"/api/auth/admins/{me['id']}/toggle", headers=auth(master_token))
    assert resp.status_code == 400


# ── Change password ───────────────────────────────────────────────────────────

def test_change_password_success(client, admin_token):
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "Admin@123", "new_password": "NewAdmin@456"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 204

    # Old password no longer works
    old = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    assert old.status_code == 401

    # New password works
    new = client.post("/api/auth/login", json={"username": "admin", "password": "NewAdmin@456"})
    assert new.status_code == 200


def test_change_password_wrong_current(client, admin_token):
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "wrongpassword", "new_password": "NewAdmin@456"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 400


# ── User auth ─────────────────────────────────────────────────────────────────

def test_user_login_success(client):
    resp = client.post("/api/user/login", json={"username": "Ahmad", "password": "Ahmad@123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["username"] == "Ahmad"


def test_user_login_wrong_password(client):
    resp = client.post("/api/user/login", json={"username": "Ahmad", "password": "wrong"})
    assert resp.status_code == 401


def test_user_me(client, user_token):
    resp = client.get("/api/user/me", headers=auth(user_token))
    assert resp.status_code == 200
    assert resp.json()["username"] == "Ahmad"


def test_user_token_cannot_access_admin_endpoint(client, user_token):
    resp = client.get("/api/auth/admins", headers=auth(user_token))
    assert resp.status_code == 403
