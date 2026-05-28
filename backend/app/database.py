import sqlite3
import hashlib
from datetime import date, timedelta
import numpy as np
from contextlib import contextmanager

from app.config import DATA_DIR

DB_PATH = DATA_DIR / "pharmacy.db"


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


def _add_column_if_missing(conn, table: str, column: str, definition: str) -> None:
    """Add a column to a table only if it doesn't already exist (SQLite migration helper)."""
    existing = [row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # M13: use _connect() so journal_mode=WAL and foreign_keys=ON are set on
    # the very first connection — previously a raw sqlite3.connect() was used
    # which skipped the WAL pragma on DB initialisation.
    with _connect() as conn:
        conn.executescript("""
        -- ── Core tables ──────────────────────────────────────────────────────────

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

        CREATE TABLE IF NOT EXISTS admins (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE,
            email         TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            role          TEXT    NOT NULL DEFAULT 'admin'
                          CHECK(role IN ('master_admin', 'admin')),
            is_active     INTEGER NOT NULL DEFAULT 1,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        -- ── Chat history ──────────────────────────────────────────────────────────

        CREATE TABLE IF NOT EXISTS chat_sessions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id   INTEGER NOT NULL,
            title      TEXT    NOT NULL DEFAULT 'New Chat',
            created_at TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role       TEXT    NOT NULL CHECK(role IN ('user', 'assistant')),
            content    TEXT    NOT NULL,
            created_at TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        );

        -- ── Users ────────────────────────────────────────────────────────────────

        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE,
            email         TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            is_active     INTEGER NOT NULL DEFAULT 1,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        -- ── User chat history ─────────────────────────────────────────────────────

        CREATE TABLE IF NOT EXISTS user_sessions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            title      TEXT    NOT NULL DEFAULT 'New Chat',
            created_at TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role       TEXT    NOT NULL CHECK(role IN ('user', 'assistant')),
            content    TEXT    NOT NULL,
            created_at TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE CASCADE
        );

        -- ── Indexes ───────────────────────────────────────────────────────────────

        CREATE INDEX IF NOT EXISTS idx_chunks_doc         ON chunks(document_id);
        CREATE INDEX IF NOT EXISTS idx_analytics_date     ON analytics(created_at);
        CREATE INDEX IF NOT EXISTS idx_admins_username    ON admins(username);
        CREATE INDEX IF NOT EXISTS idx_sessions_admin     ON chat_sessions(admin_id);
        CREATE INDEX IF NOT EXISTS idx_messages_session   ON chat_messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_users_username     ON users(username);
        CREATE INDEX IF NOT EXISTS idx_user_sessions      ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_messages      ON user_messages(session_id);

        -- H10: indexes on hot query paths that were missing
        CREATE INDEX IF NOT EXISTS idx_documents_hash     ON documents(file_hash);
        CREATE INDEX IF NOT EXISTS idx_documents_created  ON documents(created_at);
    """)

    # ── Column migrations in a separate connection (executescript auto-commits) ─
    with _connect() as conn:
        _add_column_if_missing(conn, "documents", "uploaded_by",
                               "INTEGER REFERENCES admins(id) ON DELETE SET NULL")
        _add_column_if_missing(conn, "analytics", "admin_id",
                               "INTEGER REFERENCES admins(id) ON DELETE SET NULL")


# ── Admin functions ───────────────────────────────────────────────────────────

def create_admin(username: str, email: str, password_hash: str, role: str) -> int:
    with _connect() as db:
        cursor = db.execute(
            "INSERT INTO admins (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (username, email, password_hash, role),
        )
        return cursor.lastrowid


def get_admin_by_username(username: str) -> dict | None:
    with _connect() as db:
        row = db.execute(
            "SELECT id, username, email, password_hash, role, is_active, created_at "
            "FROM admins WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0], "username": row[1], "email": row[2],
            "password_hash": row[3], "role": row[4],
            "is_active": bool(row[5]), "created_at": row[6],
        }


def get_admin_by_id(admin_id: int) -> dict | None:
    with _connect() as db:
        row = db.execute(
            "SELECT id, username, email, password_hash, role, is_active, created_at "
            "FROM admins WHERE id = ?",
            (admin_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0], "username": row[1], "email": row[2],
            "password_hash": row[3], "role": row[4],
            "is_active": bool(row[5]), "created_at": row[6],
        }


def get_all_admins() -> list[dict]:
    with _connect() as db:
        rows = db.execute(
            "SELECT id, username, email, role, is_active, created_at FROM admins ORDER BY created_at"
        ).fetchall()
        return [
            {"id": r[0], "username": r[1], "email": r[2],
             "role": r[3], "is_active": bool(r[4]), "created_at": r[5]}
            for r in rows
        ]


def admin_exists(username: str) -> bool:
    with _connect() as db:
        row = db.execute("SELECT 1 FROM admins WHERE username = ?", (username,)).fetchone()
        return row is not None


def update_admin_password(admin_id: int, new_hash: str) -> None:
    with _connect() as db:
        db.execute("UPDATE admins SET password_hash = ? WHERE id = ?", (new_hash, admin_id))


def set_admin_active(admin_id: int, is_active: bool) -> bool:
    """Toggle admin active status. Returns True if the row was found and updated."""
    with _connect() as db:
        cursor = db.execute(
            "UPDATE admins SET is_active = ? WHERE id = ?", (int(is_active), admin_id)
        )
        return cursor.rowcount > 0   # M9: callers can detect 404 instead of silent no-op


def delete_admin(admin_id: int) -> None:
    with _connect() as db:
        db.execute("DELETE FROM admins WHERE id = ?", (admin_id,))


# ── Chat session functions ────────────────────────────────────────────────────

def create_chat_session(admin_id: int, title: str) -> int:
    """Create a new chat session for an admin. Returns the session id."""
    with _connect() as db:
        cursor = db.execute(
            "INSERT INTO chat_sessions (admin_id, title) VALUES (?, ?)",
            (admin_id, title[:120]),        # cap title length
        )
        return cursor.lastrowid


def get_chat_session(session_id: int) -> dict | None:
    with _connect() as db:
        row = db.execute(
            "SELECT id, admin_id, title, created_at, updated_at "
            "FROM chat_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        if row is None:
            return None
        return {"id": row[0], "admin_id": row[1], "title": row[2],
                "created_at": row[3], "updated_at": row[4]}


def get_chat_sessions(admin_id: int) -> list[dict]:
    """Return all sessions for an admin, newest first."""
    with _connect() as db:
        rows = db.execute(
            "SELECT id, admin_id, title, created_at, updated_at "
            "FROM chat_sessions WHERE admin_id = ? ORDER BY updated_at DESC",
            (admin_id,),
        ).fetchall()
        return [{"id": r[0], "admin_id": r[1], "title": r[2],
                 "created_at": r[3], "updated_at": r[4]} for r in rows]


def add_chat_message(session_id: int, role: str, content: str) -> int:
    """Append a message to a session and bump updated_at on the session."""
    with _connect() as db:
        cursor = db.execute(
            "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )
        db.execute(
            "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?",
            (session_id,),
        )
        return cursor.lastrowid


def get_chat_messages(session_id: int) -> list[dict]:
    """Return all messages in a session in insertion order."""
    with _connect() as db:
        rows = db.execute(
            # H9: ORDER BY id (monotonic PK) instead of TEXT created_at
            # which can mis-sort messages inserted within the same second
            "SELECT id, session_id, role, content, created_at "
            "FROM chat_messages WHERE session_id = ? ORDER BY id",
            (session_id,),
        ).fetchall()
        return [{"id": r[0], "session_id": r[1], "role": r[2],
                 "content": r[3], "created_at": r[4]} for r in rows]


def delete_chat_session(session_id: int) -> None:
    """Delete a session and all its messages (cascade)."""
    with _connect() as db:
        db.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))


# ── Document functions ────────────────────────────────────────────────────────

def compute_file_hash(filepath) -> str:
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        for block in iter(lambda: f.read(8192), b""):
            sha.update(block)
    return sha.hexdigest()


def document_exists_by_hash(file_hash: str) -> bool:
    with _connect() as db:
        row = db.execute("SELECT id FROM documents WHERE file_hash = ?", (file_hash,)).fetchone()
        return row is not None


def ingest_document(
    filename: str,
    file_hash: str,
    file_size: int,
    page_count: int,
    chunks_data: list,
    uploaded_by: int | None = None,
) -> int:
    """Atomic insert: document + all its chunks in one transaction.

    If a document with the same filename exists, it gets replaced.
    chunks_data: list of (chunk_index, content, embedding_np_array)
    uploaded_by: admin id who uploaded the file (None for CLI ingestion)
    """
    with _connect() as db:
        db.execute(
            "DELETE FROM chunks WHERE document_id IN "
            "(SELECT id FROM documents WHERE filename = ?)",
            (filename,),
        )
        db.execute("DELETE FROM documents WHERE filename = ?", (filename,))

        cursor = db.execute(
            "INSERT INTO documents (filename, file_hash, file_size, page_count, uploaded_by) "
            "VALUES (?, ?, ?, ?, ?)",
            (filename, file_hash, file_size, page_count, uploaded_by),
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


def get_all_chunks() -> list:
    with _connect() as db:
        return db.execute("""
            SELECT c.id, c.content, c.embedding, d.filename
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            ORDER BY d.id, c.chunk_index
        """).fetchall()


def get_all_documents() -> list:
    with _connect() as db:
        return db.execute("""
            SELECT id, filename, file_hash, file_size, page_count, created_at
            FROM documents ORDER BY created_at
        """).fetchall()


def get_all_documents_with_chunks() -> list:
    """Return documents with their chunk counts.

    Row layout: (id, filename, file_hash, file_size, page_count, created_at, chunk_count)
    """
    with _connect() as db:
        return db.execute("""
            SELECT d.id, d.filename, d.file_hash, d.file_size, d.page_count,
                   d.created_at, COUNT(c.id) AS chunk_count
            FROM documents d
            LEFT JOIN chunks c ON c.document_id = d.id
            GROUP BY d.id
            ORDER BY d.created_at
        """).fetchall()


def delete_document(doc_id: int) -> None:
    with _connect() as db:
        db.execute("DELETE FROM chunks WHERE document_id = ?", (doc_id,))
        db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))


def get_stats() -> tuple[int, int]:
    with _connect() as db:
        docs   = db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        chunks = db.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        return docs, chunks


# ── Analytics functions ───────────────────────────────────────────────────────

def log_query(
    query_len: int,
    response_ms,
    source_files: set,
    is_emergency: bool,
    is_cached: bool,
    admin_id: int | None = None,
) -> None:
    with _connect() as db:
        db.execute(
            "INSERT INTO analytics "
            "(query_len, response_ms, source_files, is_emergency, is_cached, admin_id) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                query_len,
                response_ms,
                ",".join(sorted(source_files)),
                int(is_emergency),
                int(is_cached),
                admin_id,
            ),
        )


def get_analytics_summary() -> dict:
    with _connect() as db:
        total     = db.execute("SELECT COUNT(*) FROM analytics").fetchone()[0]
        cached    = db.execute("SELECT COUNT(*) FROM analytics WHERE is_cached=1").fetchone()[0]
        emergency = db.execute("SELECT COUNT(*) FROM analytics WHERE is_emergency=1").fetchone()[0]
        avg_row   = db.execute(
            "SELECT AVG(response_ms) FROM analytics "
            "WHERE response_ms IS NOT NULL AND is_cached=0"
        ).fetchone()
        return {
            "total":     total,
            "cached":    cached,
            "emergency": emergency,
            "avg_ms":    round(avg_row[0]) if avg_row[0] else None,
        }


def get_analytics_rich(days: int = 30) -> dict:
    """Return rich analytics data for the last `days` days."""
    # H5: use a parameterized modifier string instead of f-string interpolation
    cutoff_mod = f"-{days} days"   # e.g. "-30 days" — safe: days is always an int

    with _connect() as db:
        # Totals for the period
        total = db.execute(
            "SELECT COUNT(*) FROM analytics WHERE created_at >= datetime('now', ?)",
            (cutoff_mod,),
        ).fetchone()[0]
        cached = db.execute(
            "SELECT COUNT(*) FROM analytics WHERE is_cached=1 AND created_at >= datetime('now', ?)",
            (cutoff_mod,),
        ).fetchone()[0]
        emergency = db.execute(
            "SELECT COUNT(*) FROM analytics WHERE is_emergency=1 AND created_at >= datetime('now', ?)",
            (cutoff_mod,),
        ).fetchone()[0]
        avg_row = db.execute(
            "SELECT AVG(response_ms) FROM analytics "
            "WHERE response_ms IS NOT NULL AND is_cached=0 AND created_at >= datetime('now', ?)",
            (cutoff_mod,),
        ).fetchone()
        avg_ms = round(avg_row[0]) if avg_row[0] else None

        # Daily counts: one entry per day for the last `days` days
        daily_rows = db.execute(
            "SELECT date(created_at) as d, COUNT(*) as n "
            "FROM analytics "
            "WHERE created_at >= datetime('now', ?) "
            "GROUP BY d ORDER BY d ASC",
            (cutoff_mod,),
        ).fetchall()
        day_map = {row[0]: row[1] for row in daily_rows}
        today = date.today()
        daily_counts = [
            day_map.get(str(today - timedelta(days=days - 1 - i)), 0)
            for i in range(days)
        ]

        # Per-document citation stats from source_files field
        source_rows = db.execute(
            "SELECT source_files FROM analytics "
            "WHERE source_files != '' AND created_at >= datetime('now', ?)",
            (cutoff_mod,),
        ).fetchall()
        doc_cite: dict[str, int] = {}
        for (src_str,) in source_rows:
            for fname in src_str.split(","):
                fname = fname.strip()
                if fname:
                    doc_cite[fname] = doc_cite.get(fname, 0) + 1
        total_cites = sum(doc_cite.values()) or 1
        doc_stats = [
            {"name": k, "citations": v, "pct": round(v / total_cites * 100)}
            for k, v in sorted(doc_cite.items(), key=lambda x: -x[1])
        ]

        # Language split: detect Arabic by Unicode block
        all_queries = db.execute(
            "SELECT content FROM chat_messages cm "
            "JOIN chat_sessions cs ON cm.session_id = cs.id "
            "WHERE cm.role='user' AND cm.created_at >= datetime('now', ?)",
            (cutoff_mod,),
        ).fetchall()
        user_rows_count = db.execute(
            "SELECT content FROM user_messages um "
            "JOIN user_sessions us ON um.session_id = us.id "
            "WHERE um.role='user' AND um.created_at >= datetime('now', ?)",
            (cutoff_mod,),
        ).fetchall()
        all_texts = [r[0] for r in all_queries] + [r[0] for r in user_rows_count]
        ar_count = sum(
            1 for t in all_texts if any('؀' <= c <= 'ۿ' for c in t)
        )
        msg_total = len(all_texts) or 1
        lang_ar_pct = round(ar_count / msg_total * 100)
        lang_en_pct = 100 - lang_ar_pct

        # Average sources per reply
        avg_sources_row = db.execute(
            "SELECT AVG(length(source_files) - length(replace(source_files, ',', '')) + 1) "
            "FROM analytics WHERE source_files != '' AND created_at >= datetime('now', ?)",
            (cutoff_mod,),
        ).fetchone()
        avg_sources = round(avg_sources_row[0], 1) if avg_sources_row[0] else 0.0

        return {
            "total":        total,
            "cached":       cached,
            "emergency":    emergency,
            "avg_ms":       avg_ms,
            "daily_counts": daily_counts,
            "doc_stats":    doc_stats,
            "lang_en_pct":  lang_en_pct,
            "lang_ar_pct":  lang_ar_pct,
            "avg_sources":  avg_sources,
        }


def get_db_fingerprint() -> str:
    """String that changes whenever documents are added or removed.
    Used to detect whether the cached FAISS index is still valid."""
    with _connect() as db:
        row = db.execute(
            "SELECT COUNT(*), MAX(created_at) FROM documents"
        ).fetchone()
        return f"{row[0]}:{row[1] or 'empty'}"


# ── User functions ────────────────────────────────────────────────────────────

def create_user(username: str, email: str, password_hash: str) -> int:
    with _connect() as db:
        cursor = db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, password_hash),
        )
        return cursor.lastrowid


def get_user_by_username(username: str) -> dict | None:
    with _connect() as db:
        row = db.execute(
            "SELECT id, username, email, password_hash, is_active, created_at "
            "FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0], "username": row[1], "email": row[2],
            "password_hash": row[3], "is_active": bool(row[4]), "created_at": row[5],
        }


def get_user_by_id(user_id: int) -> dict | None:
    with _connect() as db:
        row = db.execute(
            "SELECT id, username, email, password_hash, is_active, created_at "
            "FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0], "username": row[1], "email": row[2],
            "password_hash": row[3], "is_active": bool(row[4]), "created_at": row[5],
        }


def user_exists(username: str) -> bool:
    with _connect() as db:
        row = db.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone()
        return row is not None


# ── User session functions ────────────────────────────────────────────────────

def create_user_session(user_id: int, title: str) -> int:
    with _connect() as db:
        cursor = db.execute(
            "INSERT INTO user_sessions (user_id, title) VALUES (?, ?)",
            (user_id, title[:120]),
        )
        return cursor.lastrowid


def get_user_session(session_id: int) -> dict | None:
    with _connect() as db:
        row = db.execute(
            "SELECT id, user_id, title, created_at, updated_at "
            "FROM user_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        if row is None:
            return None
        return {"id": row[0], "user_id": row[1], "title": row[2],
                "created_at": row[3], "updated_at": row[4]}


def get_user_sessions(user_id: int) -> list[dict]:
    with _connect() as db:
        rows = db.execute(
            "SELECT id, user_id, title, created_at, updated_at "
            "FROM user_sessions WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
        return [{"id": r[0], "user_id": r[1], "title": r[2],
                 "created_at": r[3], "updated_at": r[4]} for r in rows]


def add_user_message(session_id: int, role: str, content: str) -> int:
    with _connect() as db:
        cursor = db.execute(
            "INSERT INTO user_messages (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )
        db.execute(
            "UPDATE user_sessions SET updated_at = datetime('now') WHERE id = ?",
            (session_id,),
        )
        return cursor.lastrowid


def get_user_messages(session_id: int) -> list[dict]:
    with _connect() as db:
        rows = db.execute(
            # H9: ORDER BY id, same reasoning as get_chat_messages
            "SELECT id, session_id, role, content, created_at "
            "FROM user_messages WHERE session_id = ? ORDER BY id",
            (session_id,),
        ).fetchall()
        return [{"id": r[0], "session_id": r[1], "role": r[2],
                 "content": r[3], "created_at": r[4]} for r in rows]


def delete_user_session(session_id: int) -> None:
    with _connect() as db:
        db.execute("DELETE FROM user_sessions WHERE id = ?", (session_id,))
