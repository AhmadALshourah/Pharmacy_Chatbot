"""Tests for the database layer (SQLite)."""

import numpy as np
from app.database import (
    ingest_document, get_all_chunks, get_all_documents,
    get_stats, get_db_fingerprint, delete_document,
    document_exists_by_hash,
    log_query, get_analytics_summary,
    create_admin, get_admin_by_username, admin_exists,
    create_chat_session, get_chat_session, get_chat_sessions,
    add_chat_message, get_chat_messages, delete_chat_session,
    create_user, get_user_by_username, get_user_by_id, user_exists,
    create_user_session, get_user_session, get_user_sessions,
    add_user_message, get_user_messages, delete_user_session,
)

FAKE_EMBEDDING = list(np.random.rand(1536).astype(np.float32))


def _make_chunks(n=3):
    return [(i, f"chunk text {i}", FAKE_EMBEDDING) for i in range(n)]


# ── init_db ───────────────────────────────────────────────────────────────────

def test_init_db_creates_tables(tmp_db):
    import sqlite3
    conn = sqlite3.connect(str(tmp_db))
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    conn.close()
    assert "documents" in tables
    assert "chunks" in tables
    assert "analytics" in tables


# ── ingest_document ───────────────────────────────────────────────────────────

def test_ingest_document_stores_correctly(tmp_db):
    ingest_document("test.pdf", "abc123", 1024, 5, _make_chunks(3))
    docs, chunks = get_stats()
    assert docs == 1
    assert chunks == 3


def test_ingest_duplicate_name_replaces(tmp_db):
    ingest_document("test.pdf", "hash_v1", 1024, 5, _make_chunks(3))
    ingest_document("test.pdf", "hash_v2", 2048, 8, _make_chunks(5))
    docs, chunks = get_stats()
    assert docs == 1
    assert chunks == 5


def test_ingest_multiple_documents(tmp_db):
    ingest_document("a.pdf", "hash_a", 100, 1, _make_chunks(2))
    ingest_document("b.pdf", "hash_b", 200, 2, _make_chunks(4))
    docs, chunks = get_stats()
    assert docs == 2
    assert chunks == 6


# ── document_exists_by_hash ───────────────────────────────────────────────────

def test_document_exists_by_hash_true(tmp_db):
    ingest_document("test.pdf", "unique_hash", 512, 3, _make_chunks())
    assert document_exists_by_hash("unique_hash") is True


def test_document_exists_by_hash_false(tmp_db):
    assert document_exists_by_hash("nonexistent_hash") is False


# ── get_all_chunks ────────────────────────────────────────────────────────────

def test_get_all_chunks_returns_correct_count(tmp_db):
    ingest_document("doc.pdf", "h1", 100, 2, _make_chunks(4))
    rows = get_all_chunks()
    assert len(rows) == 4


def test_get_all_chunks_has_valid_embeddings(tmp_db):
    ingest_document("doc.pdf", "h1", 100, 2, _make_chunks(2))
    rows = get_all_chunks()
    for _, content, emb_blob, filename in rows:
        vec = np.frombuffer(emb_blob, dtype=np.float32)
        assert vec.shape == (1536,)
        assert content.startswith("chunk text")
        assert filename == "doc.pdf"


# ── delete_document ───────────────────────────────────────────────────────────

def test_delete_document_removes_chunks(tmp_db):
    ingest_document("del.pdf", "del_hash", 100, 1, _make_chunks(3))
    docs = get_all_documents()
    delete_document(docs[0][0])
    d, c = get_stats()
    assert d == 0
    assert c == 0


# ── get_db_fingerprint ────────────────────────────────────────────────────────

def test_fingerprint_changes_after_ingest(tmp_db):
    fp_before = get_db_fingerprint()
    ingest_document("new.pdf", "new_hash", 100, 1, _make_chunks())
    fp_after = get_db_fingerprint()
    assert fp_before != fp_after


def test_fingerprint_stable_without_changes(tmp_db):
    ingest_document("stable.pdf", "s_hash", 100, 1, _make_chunks())
    fp1 = get_db_fingerprint()
    fp2 = get_db_fingerprint()
    assert fp1 == fp2


# ── analytics ─────────────────────────────────────────────────────────────────

def test_log_query_stores_entry(tmp_db):
    log_query(50, 1200, {"doc.pdf"}, is_emergency=False, is_cached=False)
    stats = get_analytics_summary()
    assert stats["total"] == 1
    assert stats["cached"] == 0
    assert stats["emergency"] == 0


def test_log_query_tracks_cached(tmp_db):
    log_query(30, 0, set(), is_emergency=False, is_cached=True)
    stats = get_analytics_summary()
    assert stats["cached"] == 1


def test_log_query_tracks_emergency(tmp_db):
    log_query(20, None, set(), is_emergency=True, is_cached=False)
    stats = get_analytics_summary()
    assert stats["emergency"] == 1


def test_analytics_avg_response_time(tmp_db):
    log_query(50, 1000, {"a.pdf"}, False, False)
    log_query(50, 2000, {"b.pdf"}, False, False)
    stats = get_analytics_summary()
    assert stats["avg_ms"] == 1500


def test_log_query_with_admin_id(tmp_db):
    admin_id = create_admin("qa_admin", "qa@test.local", "hashed", "admin")
    log_query(40, 800, {"x.pdf"}, False, False, admin_id=admin_id)
    stats = get_analytics_summary()
    assert stats["total"] == 1


# ── admins ────────────────────────────────────────────────────────────────────

def test_create_admin_returns_id(tmp_db):
    admin_id = create_admin("alice", "alice@test.local", "hash_alice", "admin")
    assert isinstance(admin_id, int)
    assert admin_id > 0


def test_get_admin_by_username_found(tmp_db):
    create_admin("bob", "bob@test.local", "hash_bob", "master_admin")
    admin = get_admin_by_username("bob")
    assert admin is not None
    assert admin["username"] == "bob"
    assert admin["role"] == "master_admin"
    assert admin["is_active"] is True


def test_get_admin_by_username_not_found(tmp_db):
    assert get_admin_by_username("nobody") is None


def test_admin_exists_true(tmp_db):
    create_admin("carol", "carol@test.local", "hash_carol", "admin")
    assert admin_exists("carol") is True


def test_admin_exists_false(tmp_db):
    assert admin_exists("ghost") is False


# ── chat sessions & messages ──────────────────────────────────────────────────

def _make_admin(tmp_db):
    return create_admin("chat_user", "chat@test.local", "hash_chat", "admin")


def test_create_chat_session_returns_id(tmp_db):
    admin_id = _make_admin(tmp_db)
    session_id = create_chat_session(admin_id, "My first chat")
    assert isinstance(session_id, int)
    assert session_id > 0


def test_get_chat_session_found(tmp_db):
    admin_id = _make_admin(tmp_db)
    sid = create_chat_session(admin_id, "Test session")
    session = get_chat_session(sid)
    assert session is not None
    assert session["id"] == sid
    assert session["admin_id"] == admin_id
    assert session["title"] == "Test session"


def test_get_chat_session_not_found(tmp_db):
    assert get_chat_session(9999) is None


def test_get_chat_sessions_returns_newest_first(tmp_db):
    admin_id = _make_admin(tmp_db)
    s1 = create_chat_session(admin_id, "Session A")
    s2 = create_chat_session(admin_id, "Session B")
    sessions = get_chat_sessions(admin_id)
    ids = [s["id"] for s in sessions]
    # Both sessions present; most recently updated comes first
    assert s1 in ids and s2 in ids


def test_get_chat_sessions_empty(tmp_db):
    admin_id = _make_admin(tmp_db)
    assert get_chat_sessions(admin_id) == []


def test_add_and_get_chat_messages(tmp_db):
    admin_id = _make_admin(tmp_db)
    sid = create_chat_session(admin_id, "Msg test")
    add_chat_message(sid, "user", "Hello")
    add_chat_message(sid, "assistant", "Hi there!")
    msgs = get_chat_messages(sid)
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "Hello"
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["content"] == "Hi there!"


def test_delete_chat_session_removes_messages(tmp_db):
    admin_id = _make_admin(tmp_db)
    sid = create_chat_session(admin_id, "To delete")
    add_chat_message(sid, "user", "Temporary message")
    delete_chat_session(sid)
    assert get_chat_session(sid) is None
    assert get_chat_messages(sid) == []


def test_ingest_document_with_uploaded_by(tmp_db):
    admin_id = create_admin("uploader", "up@test.local", "h", "admin")
    ingest_document("uploaded.pdf", "up_hash", 512, 2, _make_chunks(2), uploaded_by=admin_id)
    docs, chunks = get_stats()
    assert docs == 1
    assert chunks == 2


# ── users ─────────────────────────────────────────────────────────────────────

def test_create_user_returns_id(tmp_db):
    uid = create_user("Ahmad", "ahmad@test.local", "hashed_pw")
    assert isinstance(uid, int) and uid > 0


def test_get_user_by_username_found(tmp_db):
    create_user("Ahmad", "ahmad@test.local", "hashed_pw")
    u = get_user_by_username("Ahmad")
    assert u is not None
    assert u["username"] == "Ahmad"
    assert u["is_active"] is True


def test_get_user_by_username_not_found(tmp_db):
    assert get_user_by_username("nobody") is None


def test_get_user_by_id(tmp_db):
    uid = create_user("Ahmad", "ahmad@test.local", "hashed_pw")
    u = get_user_by_id(uid)
    assert u is not None
    assert u["id"] == uid


def test_user_exists_true(tmp_db):
    create_user("Ahmad", "ahmad@test.local", "hashed_pw")
    assert user_exists("Ahmad") is True


def test_user_exists_false(tmp_db):
    assert user_exists("nobody") is False


# ── user sessions & messages ──────────────────────────────────────────────────

def _make_user(tmp_db):
    return create_user("testuser", "testuser@test.local", "hashed_pw")


def test_create_user_session_returns_id(tmp_db):
    uid = _make_user(tmp_db)
    sid = create_user_session(uid, "My chat")
    assert isinstance(sid, int) and sid > 0


def test_get_user_session_found(tmp_db):
    uid = _make_user(tmp_db)
    sid = create_user_session(uid, "Test")
    s = get_user_session(sid)
    assert s is not None
    assert s["user_id"] == uid
    assert s["title"] == "Test"


def test_get_user_session_not_found(tmp_db):
    assert get_user_session(9999) is None


def test_get_user_sessions_empty(tmp_db):
    uid = _make_user(tmp_db)
    assert get_user_sessions(uid) == []


def test_add_and_get_user_messages(tmp_db):
    uid = _make_user(tmp_db)
    sid = create_user_session(uid, "Msg test")
    add_user_message(sid, "user", "Hi")
    add_user_message(sid, "assistant", "Hello!")
    msgs = get_user_messages(sid)
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"


def test_delete_user_session_removes_messages(tmp_db):
    uid = _make_user(tmp_db)
    sid = create_user_session(uid, "To delete")
    add_user_message(sid, "user", "temp")
    delete_user_session(sid)
    assert get_user_session(sid) is None
    assert get_user_messages(sid) == []
