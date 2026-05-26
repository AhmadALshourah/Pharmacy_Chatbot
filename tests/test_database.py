"""Tests for the database layer (SQLite)."""

import numpy as np
from database import (
    ingest_document, get_all_chunks, get_all_documents,
    get_stats, get_db_fingerprint, delete_document,
    document_exists_by_hash,
    log_query, get_analytics_summary,
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
