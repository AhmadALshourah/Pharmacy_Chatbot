"""
Router-level tests for /api/sessions/* and /api/user/sessions/*

Tests cover: list (empty + with data), get messages, delete,
ownership enforcement (cannot access another user's session).
"""
from app.database import create_chat_session, add_chat_message, create_user_session, add_user_message
import app.database as db_module

from .conftest import auth


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_admin_id(client, admin_token):
    return client.get("/api/auth/me", headers=auth(admin_token)).json()["id"]


def _get_user_id(client, user_token):
    return client.get("/api/user/me", headers=auth(user_token)).json()["id"]


# ── Admin sessions ────────────────────────────────────────────────────────────

def test_list_sessions_empty(client, admin_token):
    resp = client.get("/api/sessions", headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_sessions_with_data(client, admin_token):
    admin_id = _get_admin_id(client, admin_token)
    create_chat_session(admin_id, "Test session")

    resp = client.get("/api/sessions", headers=auth(admin_token))
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) == 1
    assert sessions[0]["title"] == "Test session"


def test_get_session_messages(client, admin_token):
    admin_id = _get_admin_id(client, admin_token)
    sid = create_chat_session(admin_id, "Msg test")
    add_chat_message(sid, "user", "Hello")
    add_chat_message(sid, "assistant", "World")

    resp = client.get(f"/api/sessions/{sid}/messages", headers=auth(admin_token))
    assert resp.status_code == 200
    msgs = resp.json()
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"


def test_get_session_messages_ordered_by_id(client, admin_token):
    """Messages must come back in insertion order regardless of timestamp."""
    admin_id = _get_admin_id(client, admin_token)
    sid = create_chat_session(admin_id, "Order test")
    for i in range(5):
        add_chat_message(sid, "user", f"msg {i}")

    resp = client.get(f"/api/sessions/{sid}/messages", headers=auth(admin_token))
    contents = [m["content"] for m in resp.json()]
    assert contents == [f"msg {i}" for i in range(5)]


def test_delete_session(client, admin_token):
    admin_id = _get_admin_id(client, admin_token)
    sid = create_chat_session(admin_id, "To delete")

    resp = client.delete(f"/api/sessions/{sid}", headers=auth(admin_token))
    assert resp.status_code == 204

    # Verify gone
    assert client.get(f"/api/sessions/{sid}/messages", headers=auth(admin_token)).status_code == 404


def test_cannot_access_other_admins_session(client, master_token, admin_token):
    """Admin A cannot read or delete Admin B's sessions."""
    master_id = _get_admin_id(client, master_token)
    sid = create_chat_session(master_id, "Master's private session")

    # Regular admin tries to access master's session
    assert client.get(f"/api/sessions/{sid}/messages", headers=auth(admin_token)).status_code == 404
    assert client.delete(f"/api/sessions/{sid}", headers=auth(admin_token)).status_code == 404


# ── User sessions ─────────────────────────────────────────────────────────────

def test_user_list_sessions_empty(client, user_token):
    resp = client.get("/api/user/sessions", headers=auth(user_token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_user_list_sessions_with_data(client, user_token):
    user_id = _get_user_id(client, user_token)
    create_user_session(user_id, "User chat")

    resp = client.get("/api/user/sessions", headers=auth(user_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_user_delete_session(client, user_token):
    user_id = _get_user_id(client, user_token)
    sid = create_user_session(user_id, "User del")

    resp = client.delete(f"/api/user/sessions/{sid}", headers=auth(user_token))
    assert resp.status_code == 204


def test_user_cannot_access_admin_sessions(client, user_token, admin_token):
    """User token must not reach admin session endpoints."""
    resp = client.get("/api/sessions", headers=auth(user_token))
    assert resp.status_code == 403
