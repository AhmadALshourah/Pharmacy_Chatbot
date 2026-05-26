import sqlite3
import hashlib
import numpy as np
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).parent / "pharmacy.db"


@contextmanager
def _connect():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS documents (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT    NOT NULL UNIQUE,
            file_hash   TEXT    NOT NULL,
            file_size   INTEGER NOT NULL,
            page_count  INTEGER NOT NULL,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS chunks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            chunk_index INTEGER NOT NULL,
            content     TEXT    NOT NULL,
            embedding   BLOB,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS analytics (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            query_len    INTEGER NOT NULL,
            response_ms  INTEGER,
            source_files TEXT    NOT NULL DEFAULT '',
            is_emergency INTEGER NOT NULL DEFAULT 0,
            is_cached    INTEGER NOT NULL DEFAULT 0,
            created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_chunks_doc      ON chunks(document_id);
        CREATE INDEX IF NOT EXISTS idx_analytics_date  ON analytics(created_at);
    """)
    conn.close()


def compute_file_hash(filepath):
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        for block in iter(lambda: f.read(8192), b""):
            sha.update(block)
    return sha.hexdigest()


def document_exists_by_hash(file_hash):
    with _connect() as db:
        row = db.execute("SELECT id FROM documents WHERE file_hash = ?", (file_hash,)).fetchone()
        return row is not None


def ingest_document(filename, file_hash, file_size, page_count, chunks_data):
    """Atomic insert: document + all its chunks in one transaction.
    If a document with the same filename exists, it gets replaced.
    chunks_data: list of (chunk_index, content, embedding_np_array)
    """
    with _connect() as db:
        db.execute("DELETE FROM chunks WHERE document_id IN (SELECT id FROM documents WHERE filename = ?)", (filename,))
        db.execute("DELETE FROM documents WHERE filename = ?", (filename,))

        cursor = db.execute(
            "INSERT INTO documents (filename, file_hash, file_size, page_count) VALUES (?, ?, ?, ?)",
            (filename, file_hash, file_size, page_count),
        )
        doc_id = cursor.lastrowid

        db.executemany(
            "INSERT INTO chunks (document_id, chunk_index, content, embedding) VALUES (?, ?, ?, ?)",
            [
                (doc_id, idx, text, np.array(emb, dtype=np.float32).tobytes())
                for idx, text, emb in chunks_data
            ],
        )
        return doc_id


def get_all_chunks():
    with _connect() as db:
        return db.execute("""
            SELECT c.id, c.content, c.embedding, d.filename
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            ORDER BY d.id, c.chunk_index
        """).fetchall()


def get_all_documents():
    with _connect() as db:
        return db.execute("""
            SELECT id, filename, file_hash, file_size, page_count, created_at
            FROM documents ORDER BY created_at
        """).fetchall()


def delete_document(doc_id):
    with _connect() as db:
        db.execute("DELETE FROM chunks WHERE document_id = ?", (doc_id,))
        db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))


def get_stats():
    with _connect() as db:
        docs = db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        chunks = db.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        return docs, chunks


def log_query(query_len: int, response_ms, source_files: set, is_emergency: bool, is_cached: bool):
    with _connect() as db:
        db.execute(
            "INSERT INTO analytics (query_len, response_ms, source_files, is_emergency, is_cached)"
            " VALUES (?, ?, ?, ?, ?)",
            (query_len, response_ms, ",".join(sorted(source_files)), int(is_emergency), int(is_cached)),
        )


def get_analytics_summary() -> dict:
    with _connect() as db:
        total     = db.execute("SELECT COUNT(*) FROM analytics").fetchone()[0]
        cached    = db.execute("SELECT COUNT(*) FROM analytics WHERE is_cached=1").fetchone()[0]
        emergency = db.execute("SELECT COUNT(*) FROM analytics WHERE is_emergency=1").fetchone()[0]
        avg_row   = db.execute(
            "SELECT AVG(response_ms) FROM analytics WHERE response_ms IS NOT NULL AND is_cached=0"
        ).fetchone()
        return {
            "total":     total,
            "cached":    cached,
            "emergency": emergency,
            "avg_ms":    round(avg_row[0]) if avg_row[0] else None,
        }


def get_db_fingerprint() -> str:
    """Returns a string that changes whenever documents are added or removed.
    Used to detect whether the cached FAISS index is still valid."""
    with _connect() as db:
        row = db.execute(
            "SELECT COUNT(*), MAX(created_at) FROM documents"
        ).fetchone()
        return f"{row[0]}:{row[1] or 'empty'}"
