# Pharmacy Chatbot — Full Project Document

> **Purpose of this document:** Provide every detail a designer needs to create a complete, pixel-perfect UI/UX design for the Pharmacy Chatbot web application. It covers architecture, every API endpoint, every database table, every user role and permission, the current frontend state, and the features that still need UI pages.

---

## 1. Project Overview

**Pharmacy Chatbot** is a RAG-powered (Retrieval-Augmented Generation) web application that lets users ask medication-related questions. The system ingests pharmacy PDF documents, splits them into chunks, embeds them with OpenAI `text-embedding-ada-002`, indexes them in a FAISS vector store, and uses `gpt-4o-mini` to generate context-aware streaming responses.

**Target audience:**
- **Admins** (Master Admin & Admin) — manage the system: upload documents, view analytics, manage accounts, and also use the chatbot.
- **Users** — interact with the chatbot only (no admin capabilities).

**Bilingual support:** The chatbot responds in the same language the user writes in (Arabic or English). The system prompt instructs it to do so. Emergency keywords are defined in both English and Arabic.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         PROJECT ROOT                                 │
├── backend/                   Python FastAPI application              │
│   ├── app/                                                           │
│   │   ├── main.py            Entry point, lifespan, CORS, routing   │
│   │   ├── config.py          All configuration constants             │
│   │   ├── database.py        SQLite DAL (9 tables, all CRUD)        │
│   │   ├── dependencies.py    FastAPI auth dependencies               │
│   │   ├── ingest.py          PDF ingestion CLI tool                  │
│   │   ├── routers/                                                   │
│   │   │   ├── auth.py        Admin auth (login, CRUD admins)        │
│   │   │   ├── user_auth.py   User auth (login, me)                  │
│   │   │   ├── chat.py        SSE streaming chat                     │
│   │   │   ├── documents.py   PDF upload & list                      │
│   │   │   ├── analytics.py   Query statistics                       │
│   │   │   ├── sessions.py    Admin chat session management          │
│   │   │   ├── user_sessions.py  User chat session management       │
│   │   │   └── health.py      Health check                           │
│   │   ├── schemas/                                                   │
│   │   │   ├── auth.py        Admin auth Pydantic models             │
│   │   │   ├── user.py        User auth Pydantic models              │
│   │   │   ├── chat.py        Chat request/response models           │
│   │   │   ├── documents.py   Document models                        │
│   │   │   └── analytics.py   Analytics models                       │
│   │   └── services/                                                  │
│   │       ├── rag_service.py    FAISS index + LLM streaming         │
│   │       ├── auth_service.py   JWT + bcrypt                        │
│   │       ├── cache_service.py  LRU response cache                  │
│   │       └── rate_limiter.py   Sliding window rate limiter         │
│   ├── tests/                                                         │
│   ├── Dockerfile                                                     │
│   ├── requirements.txt                                               │
│   ├── ruff.toml                                                      │
│   └── pytest.ini                                                     │
├── frontend/                  React + Vite SPA                        │
│   ├── src/                                                           │
│   │   ├── main.jsx           React entry point                      │
│   │   ├── App.jsx            Router setup                           │
│   │   ├── index.css          Tailwind CSS v4 import                 │
│   │   ├── contexts/                                                  │
│   │   │   └── AuthContext.jsx Auth state provider                   │
│   │   ├── components/                                                │
│   │   │   └── ProtectedRoute.jsx  Auth guard                       │
│   │   ├── pages/                                                     │
│   │   │   ├── LoginPage.jsx  Admin login form                       │
│   │   │   └── DashboardPage.jsx  Post-login landing                 │
│   │   └── services/                                                  │
│   │       └── api.js         Full API client (fetch + SSE)          │
│   ├── Dockerfile             Multi-stage: build → nginx             │
│   ├── nginx.conf             SPA fallback + API proxy               │
│   ├── package.json                                                   │
│   └── vite.config.js                                                 │
├── data/                      Shared data directory                   │
│   ├── pdfs/                  Source PDF documents                    │
│   │   ├── Aspirin.pdf                                                │
│   │   └── Medic.pdf                                                  │
│   ├── pharmacy.db            SQLite database                        │
│   ├── pharmacy.faiss         FAISS vector index                     │
│   └── pharmacy.faiss.meta    Index fingerprint                      │
├── docker-compose.yml                                                 │
├── .github/workflows/ci.yml  GitHub Actions CI pipeline              │
├── .dockerignore                                                      │
└── .gitignore                                                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend framework** | FastAPI | 0.135.3 |
| **Python runtime** | Python | 3.12 (Docker) / 3.14.2 (dev) |
| **Frontend framework** | React | 19.2.6 |
| **Build tool** | Vite | 8.0.12 |
| **CSS framework** | Tailwind CSS | 4.3.0 |
| **Routing** | React Router | 7.15.1 |
| **Database** | SQLite (WAL mode) | built-in |
| **Vector search** | FAISS (faiss-cpu) | 1.14.2 |
| **Embeddings** | OpenAI ada-002 | via langchain-openai 1.1.12 |
| **Chat LLM** | OpenAI gpt-4o-mini | via langchain-openai 1.1.12 |
| **Auth** | JWT (HS256) via python-jose | 3.5.0 |
| **Password hashing** | bcrypt via passlib | 1.7.4 |
| **PDF parsing** | PyPDF2 | 3.0.1 |
| **Text splitting** | LangChain RecursiveCharacterTextSplitter | chunk=1000, overlap=200 |
| **Linter** | ruff | latest |
| **Tests** | pytest | 9.0.3 |
| **CI/CD** | GitHub Actions | — |
| **Containerization** | Docker + docker-compose | — |
| **Production proxy** | nginx (Alpine) | — |

---

## 3. User Roles & Permissions

There are **three distinct roles** in the system, spanning two separate account types.

### 3.1 Account Types

| Account Type | Table | Auth Endpoint | JWT `type` field |
|-------------|-------|---------------|------------------|
| **Admin** (Master Admin or Admin) | `admins` | `POST /api/auth/login` | `"admin"` |
| **User** | `users` | `POST /api/user/login` | `"user"` |

### 3.2 Roles & What Each Can Do

| Feature / Action | Master Admin | Admin | User (Ahmad) |
|-----------------|:------------:|:-----:|:------------:|
| **Login** | Yes | Yes | Yes |
| **Use the chatbot** | Yes | Yes | Yes |
| **View own chat history** | Yes | Yes | Yes |
| **Delete own chat sessions** | Yes | Yes | Yes |
| **Upload PDF documents** | Yes | Yes | No |
| **View document list** | Yes | Yes | No |
| **View analytics dashboard** | Yes | Yes | No |
| **Create new admin accounts** | Yes | No | No |
| **Delete admin accounts** | Yes | No | No |
| **Activate/deactivate admins** | Yes | No | No |
| **View all admin accounts** | Yes | No | No |
| **Change own password** | Yes | Yes | No (not yet) |

### 3.3 Default Seeded Accounts

These accounts are automatically created on first startup:

| Role | Username | Email | Default Password | Env Override |
|------|----------|-------|-----------------|--------------|
| Master Admin | `master_admin` | `master@pharmacy.local` | `MasterAdmin@123` | `MASTER_ADMIN_PASSWORD` |
| Admin | `admin` | `admin@pharmacy.local` | `Admin@123` | `ADMIN_PASSWORD` |
| User | `Ahmad` | `ahmad@pharmacy.local` | `Ahmad@123` | `AHMAD_PASSWORD` |

---

## 4. Database Schema (SQLite)

9 tables total. WAL journal mode. Foreign keys enforced.

### 4.1 Entity Relationship Diagram

```
admins ─────────────┬──── chat_sessions ──── chat_messages
  │                 │
  │ (uploaded_by)   │ (admin_id FK)
  ▼                 │
documents ── chunks │
                    │
  analytics ────────┘ (admin_id FK)

users ──── user_sessions ──── user_messages
```

### 4.2 Table Definitions

#### `admins`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `username` | TEXT | NOT NULL UNIQUE |
| `email` | TEXT | NOT NULL UNIQUE |
| `password_hash` | TEXT | NOT NULL |
| `role` | TEXT | NOT NULL DEFAULT 'admin', CHECK IN ('master_admin', 'admin') |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') |

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `username` | TEXT | NOT NULL UNIQUE |
| `email` | TEXT | NOT NULL UNIQUE |
| `password_hash` | TEXT | NOT NULL |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') |

#### `documents`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `filename` | TEXT | NOT NULL UNIQUE |
| `file_hash` | TEXT | NOT NULL (SHA-256) |
| `file_size` | INTEGER | NOT NULL (bytes) |
| `page_count` | INTEGER | NOT NULL |
| `uploaded_by` | INTEGER | NULLABLE, FK → admins(id) ON DELETE SET NULL |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') |

#### `chunks`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `document_id` | INTEGER | NOT NULL, FK → documents(id) ON DELETE CASCADE |
| `chunk_index` | INTEGER | NOT NULL |
| `content` | TEXT | NOT NULL |
| `embedding` | BLOB | float32 numpy array (1536 dimensions) |

#### `chat_sessions` (admin chat sessions)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `admin_id` | INTEGER | NOT NULL, FK → admins(id) ON DELETE CASCADE |
| `title` | TEXT | NOT NULL DEFAULT 'New Chat' (auto-set from first message, max 120 chars) |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') |
| `updated_at` | TEXT | NOT NULL DEFAULT datetime('now') (bumped on each new message) |

#### `chat_messages` (admin chat messages)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `session_id` | INTEGER | NOT NULL, FK → chat_sessions(id) ON DELETE CASCADE |
| `role` | TEXT | NOT NULL CHECK IN ('user', 'assistant') |
| `content` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') |

#### `user_sessions` (user chat sessions)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `user_id` | INTEGER | NOT NULL, FK → users(id) ON DELETE CASCADE |
| `title` | TEXT | NOT NULL DEFAULT 'New Chat' |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') |
| `updated_at` | TEXT | NOT NULL DEFAULT datetime('now') |

#### `user_messages` (user chat messages)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `session_id` | INTEGER | NOT NULL, FK → user_sessions(id) ON DELETE CASCADE |
| `role` | TEXT | NOT NULL CHECK IN ('user', 'assistant') |
| `content` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') |

#### `analytics`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT |
| `query_len` | INTEGER | NOT NULL |
| `response_ms` | INTEGER | NULLABLE (NULL for emergency queries) |
| `source_files` | TEXT | NOT NULL DEFAULT '' (comma-separated filenames) |
| `is_emergency` | INTEGER | NOT NULL DEFAULT 0 |
| `is_cached` | INTEGER | NOT NULL DEFAULT 0 |
| `admin_id` | INTEGER | NULLABLE, FK → admins(id) ON DELETE SET NULL |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') |

### 4.3 Indexes

| Index | Table | Column(s) |
|-------|-------|-----------|
| `idx_chunks_doc` | chunks | document_id |
| `idx_analytics_date` | analytics | created_at |
| `idx_admins_username` | admins | username |
| `idx_sessions_admin` | chat_sessions | admin_id |
| `idx_messages_session` | chat_messages | session_id |
| `idx_users_username` | users | username |
| `idx_user_sessions` | user_sessions | user_id |
| `idx_user_messages` | user_messages | session_id |

---

## 5. Complete API Reference

**Base URL:** `/api`  
**Auth:** JWT Bearer token in `Authorization: Bearer <token>` header.  
**Content-Type:** `application/json` (except file uploads: `multipart/form-data`).

### 5.1 Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | None | Service status + document counts |

**Response:**
```json
{ "status": "ok", "docs": 2, "chunks": 47 }
```

### 5.2 Admin Authentication (`/api/auth/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | None | Admin login, returns JWT |
| `GET` | `/api/auth/me` | Admin | Current admin profile |
| `POST` | `/api/auth/change-password` | Admin | Change own password |
| `GET` | `/api/auth/admins` | Master Admin | List all admin accounts |
| `POST` | `/api/auth/admins` | Master Admin | Create a new admin |
| `DELETE` | `/api/auth/admins/{admin_id}` | Master Admin | Delete an admin (cannot delete self) |
| `PATCH` | `/api/auth/admins/{admin_id}/toggle` | Master Admin | Toggle admin active/inactive |

**`POST /api/auth/login`**

Request:
```json
{ "username": "master_admin", "password": "MasterAdmin@123" }
```
Response (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "admin": {
    "id": 1,
    "username": "master_admin",
    "email": "master@pharmacy.local",
    "role": "master_admin",
    "is_active": true,
    "created_at": "2025-01-01 00:00:00"
  }
}
```

**`POST /api/auth/admins`** (Create admin)

Request:
```json
{
  "username": "new_admin",
  "email": "new@pharmacy.local",
  "password": "SecurePass@123",
  "role": "admin"
}
```
Validation: username 3-50 chars, password min 8 chars, role must be `"master_admin"` or `"admin"`.

**`POST /api/auth/change-password`**

Request:
```json
{ "current_password": "OldPass@123", "new_password": "NewPass@456" }
```

### 5.3 User Authentication (`/api/user/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/user/login` | None | User login, returns JWT |
| `GET` | `/api/user/me` | User | Current user profile |

**`POST /api/user/login`**

Request:
```json
{ "username": "Ahmad", "password": "Ahmad@123" }
```
Response (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "Ahmad",
    "email": "ahmad@pharmacy.local",
    "is_active": true,
    "created_at": "2025-01-01 00:00:00"
  }
}
```

### 5.4 Chat (`/api/chat`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/chat` | Admin **or** User | Stream chatbot response via SSE |

Both admin and user tokens are accepted. Sessions are stored in separate tables based on who is calling.

**Request:**
```json
{
  "message": "What are the side effects of Aspirin?",
  "history": [
    { "role": "user", "content": "Tell me about Aspirin" },
    { "role": "assistant", "content": "Aspirin is..." }
  ],
  "session_id": null
}
```

- `message` (required): 1–2000 characters.
- `history` (optional): array of previous messages for multi-turn context.
- `session_id` (optional): existing session ID to append to. If omitted, a new session is created and the title is auto-set from the first 60 characters of the message.

**Response:** Server-Sent Events (SSE) stream. Content-Type: `text/event-stream`.

SSE event types:
```
data: {"token": "Aspirin is a non-steroidal..."}       ← cumulative text as tokens stream
data: {"token": "Aspirin is a non-steroidal anti-..."}  ← next token appended
...
data: {"done": true, "content": "Full response text...\n\n*Sources: Aspirin.pdf*", "sources": ["Aspirin.pdf"], "session_id": 5}
```

Error event:
```
data: {"error": "Something went wrong. Please try again."}
```

**Chat behavior details:**
- The assistant response includes `*Sources: filename1.pdf, filename2.pdf*` appended at the end.
- The user's message is saved to the database BEFORE streaming starts.
- The assistant's full response is saved to the database AFTER streaming completes.
- Each query is logged in the `analytics` table with response time, source files, cache hit, and emergency flag.

### 5.5 Admin Chat Sessions (`/api/sessions/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/sessions` | Admin | List all sessions for current admin (newest first) |
| `GET` | `/api/sessions/{session_id}/messages` | Admin | Get all messages in a session |
| `DELETE` | `/api/sessions/{session_id}` | Admin | Delete a session and all its messages |

Admins can only see/delete their own sessions.

**`GET /api/sessions`** Response:
```json
[
  {
    "id": 5,
    "admin_id": 1,
    "title": "What are the side effects of Aspirin?",
    "created_at": "2025-05-28 10:30:00",
    "updated_at": "2025-05-28 10:31:00"
  }
]
```

**`GET /api/sessions/{id}/messages`** Response:
```json
[
  {
    "id": 1,
    "session_id": 5,
    "role": "user",
    "content": "What are the side effects of Aspirin?",
    "created_at": "2025-05-28 10:30:00"
  },
  {
    "id": 2,
    "session_id": 5,
    "role": "assistant",
    "content": "The common side effects of Aspirin include...\n\n*Sources: Aspirin.pdf*",
    "created_at": "2025-05-28 10:30:05"
  }
]
```

### 5.6 User Chat Sessions (`/api/user/sessions/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/user/sessions` | User | List all sessions for current user (newest first) |
| `GET` | `/api/user/sessions/{session_id}/messages` | User | Get all messages in a session |
| `DELETE` | `/api/user/sessions/{session_id}` | User | Delete a session and all its messages |

Identical structure to admin sessions but scoped to the user's own data.

### 5.7 Documents (`/api/documents/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/documents/upload` | Admin | Upload a PDF file for ingestion |
| `GET` | `/api/documents` | Admin | List all ingested documents |

**`POST /api/documents/upload`**

Request: `multipart/form-data` with a `file` field containing a `.pdf` file.

Response (200):
```json
{
  "success": true,
  "message": "Aspirin.pdf added successfully!",
  "doc_count": 3,
  "chunk_count": 65
}
```

Processing pipeline: PDF → PyPDF2 text extraction → RecursiveCharacterTextSplitter (1000 char chunks, 200 overlap) → OpenAI ada-002 embeddings (1536 dimensions) → stored in `documents` + `chunks` tables → FAISS index rebuilt.

Duplicate detection: files are hashed with SHA-256. If the same content is uploaded again (same hash), it's rejected. If the same filename is uploaded with different content, the old one is replaced.

**`GET /api/documents`** Response:
```json
[
  {
    "id": 1,
    "filename": "Aspirin.pdf",
    "page_count": 3,
    "file_size": 125432,
    "created_at": "2025-05-28 09:00:00"
  }
]
```

### 5.8 Analytics (`/api/analytics`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/analytics` | None (currently) | Aggregated query statistics |

**Response:**
```json
{
  "total": 150,
  "cached": 23,
  "emergency": 2,
  "avg_ms": 1340,
  "doc_count": 3,
  "chunk_count": 65
}
```

---

## 6. RAG Pipeline Details

### 6.1 Ingestion Flow
```
PDF file
  ↓
PyPDF2 text extraction (page by page)
  ↓
RecursiveCharacterTextSplitter
  chunk_size=1000, chunk_overlap=200
  separators=["\n\n", "\n", ". ", " ", ""]
  ↓
OpenAI text-embedding-ada-002
  output: 1536-dimensional float32 vectors
  ↓
SQLite: documents + chunks (with BLOB embeddings)
  ↓
FAISS IndexFlatIP (inner product / cosine similarity)
  saved to data/pharmacy.faiss
  fingerprint saved to data/pharmacy.faiss.meta
```

### 6.2 Query Flow
```
User message
  ↓
Input validation (max 2000 chars)
  ↓
Rate limiting (20 requests / 60 seconds, sliding window)
  ↓
Emergency keyword detection (EN + AR)
  → If emergency: return emergency response immediately
  ↓
LRU cache lookup (max 100 entries)
  → If cache hit: return cached response
  ↓
Embed query with ada-002
  ↓
FAISS search: top-4 most similar chunks (cosine similarity)
  ↓
Build LLM context: system prompt + retrieved chunks + conversation history
  ↓
Stream response via gpt-4o-mini (temperature=0.3)
  ↓
Append source citations (*Sources: file1.pdf, file2.pdf*)
  ↓
Log to analytics table
  ↓
Cache the response (for context-free queries only)
```

### 6.3 System Prompt
The chatbot follows strict rules:
- Provides accurate medication information (uses, dosage, side effects, contraindications, storage).
- All answers must be based strictly on the provided PDF documents.
- If the documents don't contain the answer, it says so clearly.
- Checks for drug interactions when the user asks about combining medications.
- Flags known interactions with a warning marker and severity level.
- Never diagnoses medical conditions.
- Always ends answers with a reminder to consult a pharmacist or doctor.
- Responds in the same language the user writes in (Arabic or English).

### 6.4 Emergency Detection
Keyword-based detection in both English and Arabic:
- Overdose: "overdose", "took too many", "took too much", "جرعة زائدة", "تناولت كثيراً"
- Poisoning: "poisoning", "toxic", "تسمم"
- Self-harm: "want to die", "suicide", "أريد أن أموت", "انتحار"
- Breathing: "can't breathe", "difficulty breathing", "لا أستطيع التنفس", "صعوبة في التنفس"
- Cardiac: "chest pain", "heart attack", "ألم في الصدر", "نوبة قلبية"
- Consciousness: "unconscious", "passed out", "فقدان الوعي"
- Severe allergy: "anaphylaxis", "severe allergic", "حساسية شديدة"

When detected, the chatbot immediately returns a table of emergency numbers (112, 911, 999, Jordan 191) and poison control numbers, without proceeding to the LLM.

---

## 7. Authentication System

### 7.1 JWT Token Structure

**Admin token payload:**
```json
{
  "sub": "1",
  "username": "master_admin",
  "role": "master_admin",
  "type": "admin",
  "exp": 1717000000
}
```

**User token payload:**
```json
{
  "sub": "1",
  "username": "Ahmad",
  "type": "user",
  "exp": 1717000000
}
```

- Algorithm: HS256
- Expiration: 8 hours (`JWT_EXPIRE_MINUTES = 480`)
- Secret: `JWT_SECRET_KEY` environment variable
- Storage: `localStorage` key `pharmacy_token`

### 7.2 Auth Flow
1. User submits username + password to login endpoint.
2. Backend verifies password against bcrypt hash in database.
3. Backend issues JWT with role/type claims.
4. Frontend stores token in `localStorage`.
5. All subsequent requests include `Authorization: Bearer <token>`.
6. Backend `dependencies.py` validates token, loads account from DB, checks `is_active`.

### 7.3 Backend Auth Dependencies

| Dependency | Accepts | Used by |
|-----------|---------|---------|
| `get_current_admin` | Admin tokens only | Document upload, admin sessions, admin CRUD, analytics |
| `get_current_user` | User tokens only | User sessions, user profile |
| `get_current_principal` | Admin **or** User tokens | Chat endpoint |
| `require_master_admin` | Master Admin tokens only | Create/delete/toggle admin accounts |

---

## 8. Frontend — Current State

### 8.1 Implemented Pages

| Route | Component | Auth | Status |
|-------|-----------|------|--------|
| `/login` | `LoginPage` | Public | Fully built, dark theme |
| `/dashboard` | `DashboardPage` | Protected (admin only) | Placeholder with 3 static cards |
| `*` (catch-all) | Redirect to `/dashboard` | — | Working |

### 8.2 Current Frontend Theme & Style

**Design language:** Dark theme, glassmorphic cards, rounded corners (2xl = 16px), modern SaaS aesthetic.

**Color palette (currently used):**
| Element | Tailwind Classes |
|---------|-----------------|
| Background | `bg-slate-900`, gradient `from-slate-900 via-blue-950 to-slate-900` |
| Card backgrounds | `bg-white/5`, `bg-white/10` on hover |
| Card borders | `border-white/10` |
| Primary text | `text-white` |
| Secondary text | `text-slate-300`, `text-slate-400` |
| Muted text | `text-slate-500` |
| Primary accent | `bg-blue-600`, `hover:bg-blue-500` |
| Accent text highlight | `text-blue-400` |
| Error bg | `bg-red-500/10`, `border-red-500/20`, `text-red-400` |
| Master Admin badge | `bg-purple-500/20 text-purple-300 border-purple-500/30` |
| Admin badge | `bg-blue-500/20 text-blue-300 border-blue-500/30` |

**Form inputs:** Rounded-xl, `bg-white/10`, `border-white/10`, focus ring `ring-blue-500`.

**Logo:** Pill emoji (💊) in a 64x64 rounded-2xl blue container.

### 8.3 What the Frontend API Client Already Supports

The `api.js` service file already has functions for all backend endpoints:

| Function | Backend Endpoint | Status |
|----------|-----------------|--------|
| `login(username, password)` | `POST /api/auth/login` | Admin login only |
| `getMe()` | `GET /api/auth/me` | Admin only |
| `changePassword(current, new)` | `POST /api/auth/change-password` | Ready |
| `listAdmins()` | `GET /api/auth/admins` | Ready |
| `createAdmin(...)` | `POST /api/auth/admins` | Ready |
| `deleteAdmin(id)` | `DELETE /api/auth/admins/{id}` | Ready |
| `toggleAdmin(id)` | `PATCH /api/auth/admins/{id}/toggle` | Ready |
| `getHealth()` | `GET /api/health` | Ready |
| `streamChat(message, history)` | `POST /api/chat` | Ready (SSE async generator) |
| `getDocuments()` | `GET /api/documents` | Ready |
| `uploadDocument(file)` | `POST /api/documents/upload` | Ready |
| `getAnalytics()` | `GET /api/analytics` | Ready |

**Not yet in `api.js`:** User login, user me, admin session list/messages/delete, user session list/messages/delete. These endpoints exist in the backend but the frontend client functions haven't been written.

### 8.4 Auth Context (`AuthContext.jsx`)

```
AuthProvider
  ├── state: admin (object | null), loading (bool)
  ├── login(username, password) → calls API, stores token, sets admin state
  ├── logout() → clears token and admin state
  └── On mount: validates stored token via GET /api/auth/me
```

Currently only handles admin accounts. Needs to be extended to support user accounts, or a separate `UserAuthContext` is needed.

---

## 9. Pages / Screens That Need to Be Designed

This is the most important section for the designer. Below is every page/screen the application needs, organized by user role.

### 9.1 Public Pages (No Auth Required)

#### P1: Login Page ✅ (exists — admin only)
- Dark gradient background.
- Centered card with pill logo, "Pharmacy Chatbot" title, "Admin Portal" subtitle.
- Username and password fields.
- Error banner on failed login.
- "Sign in" button.
- **Design need:** Needs to be updated or a separate version created for user login. Options:
  - Single login page with a role toggle (Admin / User tabs).
  - Two separate login pages (`/login` for admin, `/user/login` for user).
  - Single login page that auto-detects (try admin endpoint first, then user) — not recommended.

### 9.2 Admin Pages (Protected — Admin or Master Admin)

#### P2: Dashboard / Home Page (partially exists)
Current state: shows a welcome message, role badge, and 3 placeholder cards (Chat, Documents, Analytics).
**Design need:** This should become a functional navigation hub. The 3 cards should link to their respective pages. Consider adding quick stats (total documents, total queries, recent activity).

#### P3: Chat Page
The core feature. This is where admins interact with the RAG chatbot.
**Design need:** Full chat interface with:
- **Left sidebar:** List of past chat sessions (from `GET /api/sessions`), showing title and date, newest first. "New Chat" button at top. Click a session to load its messages. Delete button per session.
- **Main area:** Chat message thread. User messages on one side, assistant messages on the other. Support markdown rendering in assistant responses (the LLM uses `**bold**`, `⚠️ WARNING:`, tables, bullet points). Show source citations distinctly (e.g., pills/tags at the bottom of each assistant message).
- **Input area:** Text input at the bottom, send button. Show "typing" / streaming indicator while tokens arrive. Disable send during streaming.
- **Emergency responses:** These have a distinct format (red/urgent styling with a table of phone numbers).
- **Session management:** Auto-create a new session on first message (session_id comes back in the SSE "done" event). Load history when clicking an existing session.

#### P4: Documents Management Page
Admin-only page for managing the knowledge base.
**Design need:**
- **Document list table:** Columns: filename, page count, file size (formatted: KB/MB), upload date. Consider a delete button per document (backend `DELETE` not yet exposed via API but exists in DB layer).
- **Upload area:** Drag-and-drop zone or file picker. Only accepts `.pdf`. Show upload progress/status. After success, show updated doc count and chunk count.
- **Stats bar:** Total documents, total chunks.

#### P5: Analytics Dashboard
Admin-only page showing query statistics.
**Design need:**
- **Summary cards:** Total queries, cached responses, emergency detections, average response time (ms).
- **Document stats:** Total documents, total chunks.
- **Consider:** Charts/graphs if the design tool supports them (e.g., queries over time, cache hit ratio pie chart). Note: the backend currently only returns aggregated totals, not time-series data. Charts would need new backend endpoints.

#### P6: Admin Management Page (Master Admin only)
Only visible to `master_admin` role.
**Design need:**
- **Admin list table:** Columns: username, email, role (badge), status (active/inactive badge), created date. Action buttons: toggle active/inactive, delete.
- **Create admin form:** Username, email, password, role dropdown (master_admin / admin). Could be a modal or a dedicated section.
- **Safety:** Cannot delete or deactivate yourself (backend enforces this, but disable the buttons in UI too).

#### P7: Settings / Profile Page (optional but recommended)
**Design need:**
- Change password form (current password + new password + confirm).
- Display current user info: username, email, role, member since.

### 9.3 User Pages (Protected — User role)

#### P8: User Login Page
See P1 discussion. Needs its own login flow calling `POST /api/user/login`.

#### P9: User Chat Page
The only functional page for users. Same chat interface as P3, but:
- No document management access.
- No analytics access.
- No admin management.
- Sessions come from `GET /api/user/sessions` instead of `GET /api/sessions`.
- Simpler header/nav (just logo, username, sign out).

### 9.4 Shared Components

| Component | Description |
|-----------|-------------|
| **Header / Top Nav** | Logo (💊), app name, role badge, username, sign-out button. Currently exists in DashboardPage but should be extracted. |
| **Sidebar** | Navigation links. Admin sees: Chat, Documents, Analytics, (Admin Management if master). User sees: Chat only. |
| **Chat Bubble** | User message bubble vs. assistant message bubble. Different alignment and colors. |
| **Markdown Renderer** | For assistant responses. Must handle: bold, italics, tables, bullet/numbered lists, warning emoji blocks, code blocks. |
| **Role Badge** | Purple for Master Admin, Blue for Admin, a third color for User (e.g., green). |
| **Loading States** | Full-page spinner (on auth check), inline loading (button spinners), skeleton loaders (for lists). |
| **Empty States** | No documents uploaded, no chat sessions, no analytics data. |
| **Error Toasts** | For API errors, upload failures, auth errors. |
| **Confirmation Dialogs** | "Are you sure?" for delete actions (documents, sessions, admin accounts). |
| **File Upload Zone** | Drag-and-drop with file type validation (.pdf only). |

---

## 10. Navigation Structure

### 10.1 Admin Navigation

```
/login                    → LoginPage (public)
/dashboard                → Dashboard home (P2)
/dashboard/chat           → Chat interface (P3)
/dashboard/documents      → Document management (P4)
/dashboard/analytics      → Analytics dashboard (P5)
/dashboard/admins         → Admin management (P6, master_admin only)
/dashboard/settings       → Profile & password change (P7)
```

### 10.2 User Navigation

```
/user/login               → User login (P8)
/user/chat                → User chat interface (P9)
```

Or alternatively, use the same `/dashboard` route but with different layouts/sidebars based on role.

---

## 11. Real-time Behavior & Interactions

### 11.1 Chat Streaming
- The response streams token by token via SSE.
- Each SSE event contains cumulative text (not just the new token).
- The frontend should render the text progressively, creating a "typing" effect.
- The final event includes `done: true`, the complete response, extracted source filenames, and the `session_id`.
- If the user sends a message without a `session_id`, a new session is created server-side and the `session_id` is returned in the final event. The frontend should store this and use it for subsequent messages in the same conversation.

### 11.2 Session Auto-Title
When a new session is created, the title is set to the first 60 characters of the user's first message. This appears in the session list sidebar.

### 11.3 Document Upload
After a successful upload, the FAISS index is rebuilt automatically on the server side. New documents are immediately available for chat queries.

---

## 12. Configuration Constants (Design-Relevant)

| Constant | Value | Relevance |
|----------|-------|-----------|
| `MAX_QUERY_LENGTH` | 2000 characters | Input field max length |
| `RATE_LIMIT_REQUESTS` | 20 per 60 seconds | Show rate limit error in UI |
| `CACHE_MAX_SIZE` | 100 responses | Cache hit indicator (optional) |
| `JWT_EXPIRE_MINUTES` | 480 (8 hours) | Session duration before re-login |
| `RETRIEVAL_TOP_K` | 4 chunks | Number of sources cited |
| `CHAT_MODEL` | gpt-4o-mini | Display in footer/about |
| `CHAT_TEMPERATURE` | 0.3 | — |

---

## 13. Error States the UI Must Handle

| Error | When | Suggested UX |
|-------|------|-------------|
| Invalid credentials (401) | Login with wrong password | Red error banner on login form |
| Account deactivated (403) | Login with inactive account | Specific message: "Contact admin" |
| Token expired (401) | Any authenticated request | Redirect to login, clear token |
| Admin access required (403) | User tries admin endpoints | Redirect or hide UI element |
| Master Admin required (403) | Regular admin tries master endpoints | Hide admin management nav item |
| Rate limited | Too many chat messages | Toast: "Please wait a moment" |
| No documents loaded | Chat with empty knowledge base | Message: "Upload a PDF first" |
| Upload failed | Bad file or server error | Error message in upload area |
| Session not found (404) | Deleted session accessed | Remove from sidebar, show notice |
| Network/connection error | Offline or server down | Toast or banner |
| Emergency detection | Emergency keywords in chat | Distinct red/urgent response card |

---

## 14. Deployment Architecture

```
docker-compose.yml:
  ┌─────────────────────────┐     ┌─────────────────────────┐
  │  frontend (nginx:alpine)│     │  backend (python:3.12)  │
  │  Port: 3000 → 80       │────→│  Port: 8000             │
  │  Serves React SPA       │     │  FastAPI + Uvicorn      │
  │  Proxies /api/ to backend│    │  SQLite in /app/data    │
  └─────────────────────────┘     └─────────────────────────┘
                                          │
                                  ┌───────┴───────┐
                                  │  data/ volume  │
                                  │  pharmacy.db   │
                                  │  pharmacy.faiss│
                                  │  pdfs/         │
                                  └───────────────┘
```

- **Dev mode:** Vite dev server (port 5173) proxies `/api` to backend (port 8000).
- **Production:** nginx serves static files, proxies `/api/` to backend container. SSE requires `proxy_buffering off` and `Connection ''` headers (already configured).

---

## 15. Test Coverage

**62 tests, all passing.** Coverage includes:
- Config sanity checks (emergency keywords, models, limits).
- Input validation (empty, whitespace, max length, normal queries).
- Emergency keyword detection (English + Arabic, case-insensitive).
- Document ingestion (single, duplicate, multiple, with uploaded_by).
- Document hash deduplication.
- Chunk retrieval and embedding integrity (1536-dim float32).
- Document deletion with cascade.
- FAISS fingerprint stability and change detection.
- Analytics logging (standard, cached, emergency, with admin_id).
- Admin CRUD (create, get by username, get by ID, exists check).
- Admin chat sessions (create, get, list, delete with cascade).
- Admin chat messages (add, get ordered, cascade on session delete).
- User CRUD (create, get by username, get by ID, exists check).
- User chat sessions (create, get, list, delete with cascade).
- User chat messages (add, get ordered, cascade on session delete).

---

## 16. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key for embeddings and chat |
| `JWT_SECRET_KEY` | Recommended | `"change-this-secret-in-production-please"` | JWT signing secret |
| `MASTER_ADMIN_PASSWORD` | No | `MasterAdmin@123` | Override default master admin password |
| `ADMIN_PASSWORD` | No | `Admin@123` | Override default admin password |
| `AHMAD_PASSWORD` | No | `Ahmad@123` | Override default user password |

---

## 17. Summary for the Designer

**What to design:**
1. A cohesive dark-themed web application with the aesthetic described in Section 8.2.
2. Two user flows: **Admin flow** (full management) and **User flow** (chat only).
3. **9 pages** total (P1–P9) with the specific features described in Section 9.
4. A responsive layout that works on desktop and tablet at minimum.
5. A chat interface that supports streaming text, markdown rendering, source citations, and emergency response styling.

**Key design decisions needed:**
- Single login page with role toggle vs. separate login pages for admin and user.
- Sidebar navigation vs. top-bar navigation for the dashboard.
- Whether the user flow shares the same layout as admin (with fewer nav items) or has its own distinct layout.
- Chat session sidebar: always visible or collapsible?
- Mobile responsiveness priority: desktop-first or mobile-first?

**Constraints:**
- Tailwind CSS v4 utility classes only (no custom CSS framework).
- Must support both English and Arabic text in chat responses (the chatbot replies in the user's language).
- Dark theme is established; maintain the existing color palette for consistency.
