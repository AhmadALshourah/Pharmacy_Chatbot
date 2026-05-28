# Aspira — Pharmacy Chatbot

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai&logoColor=white)](https://openai.com)
[![FAISS](https://img.shields.io/badge/FAISS-1.14-red)](https://github.com/facebookresearch/faiss)
[![Tests](https://img.shields.io/badge/Tests-62%20passing-brightgreen)](backend/tests)
[![CI](https://github.com/AhmadALshourah/Pharmacy_Chatbot/actions/workflows/ci.yml/badge.svg)](https://github.com/AhmadALshourah/Pharmacy_Chatbot/actions)

A production-quality **RAG-powered pharmacy assistant** built as a full-stack web application. Admins upload PDF drug references; the chatbot answers medication questions in real time by retrieving the most relevant chunks and streaming the response token-by-token — citing every source it uses.

---

## Features

| | Feature |
|---|---------|
| 🔍 | **RAG pipeline** — answers grounded in your own PDF documents, never hallucinated |
| 🌊 | **SSE streaming** — tokens appear word-by-word as the LLM generates them |
| 🌐 | **Bilingual** — responds in Arabic or English based on the user's language |
| 🚨 | **Emergency detection** — 46 keywords (EN + AR) bypass the LLM and return emergency numbers instantly |
| ⚠️ | **Drug interaction warnings** — LLM flags ⚠️ interactions with severity when asked about combining medications |
| 🔐 | **Role-based auth** — JWT with three roles: Master Admin, Admin, User |
| 📊 | **Analytics dashboard** — query volume, cache rate, response latency, per-document citations |
| 🌙 | **Dark mode** — toggle in sidebar, persisted in `localStorage` |
| 📱 | **Responsive** — off-canvas sidebar with overlay on small screens |
| 🐳 | **Docker-ready** — single `docker compose up --build` starts the full stack |
| ✅ | **62 tests** — backend unit + integration tests, zero OpenAI calls required |

---

## Architecture

```
Browser (React 19 + Vite)
         │  JWT in Authorization header
         │  SSE for chat streaming
         ▼
  ┌──────────────────────────────────────┐
  │       nginx (port 3000)              │
  │  serves SPA + proxies /api/ →        │
  └──────────────┬───────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────────┐
  │         FastAPI (port 8000)          │
  │                                      │
  │  /api/auth/*    JWT login, admin mgmt│
  │  /api/user/*    User login + sessions│
  │  /api/chat      SSE streaming chat   │
  │  /api/documents PDF upload + delete  │
  │  /api/sessions  Chat history         │
  │  /api/analytics Query telemetry      │
  │  /api/health    Health check         │
  └───────┬──────────────────────────────┘
          │
          ├── RAG Service ──────────────────────────────────────────────┐
          │   1. Rate limit + emergency keyword check                   │
          │   2. LRU cache lookup (max 100 entries)                     │
          │   3. Embed query → OpenAI text-embedding-ada-002 (1536-d)  │
          │   4. FAISS cosine search → top-4 chunks                    │
          │   5. Stream via gpt-4o-mini (temperature 0.3)              │
          │   6. Append source citations, log to analytics             │
          └────────────────────────────────────────────────────────────┘
          │
          └── SQLite (WAL mode) ─ 9 tables ──────────────────────────────
              admins · users · documents · chunks
              chat_sessions · chat_messages
              user_sessions · user_messages · analytics
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, React Router 7, custom CSS design system |
| **Backend** | FastAPI 0.135, Uvicorn, Python 3.12 |
| **LLM** | OpenAI `gpt-4o-mini` via LangChain |
| **Embeddings** | OpenAI `text-embedding-ada-002` (1536-d) |
| **Vector search** | FAISS `IndexFlatIP` (cosine similarity) |
| **Database** | SQLite with WAL mode, 9 tables |
| **PDF parsing** | PyPDF2 + LangChain `RecursiveCharacterTextSplitter` |
| **Auth** | JWT HS256 via `python-jose`, bcrypt via `passlib` |
| **Production** | Docker + nginx (multi-stage build) |
| **CI** | GitHub Actions — lint + 62 tests on every push |

---

## Quick Start (local dev)

### Prerequisites

- Python 3.12+
- Node.js 20+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### 1. Clone and configure

```bash
git clone https://github.com/AhmadALshourah/Pharmacy_Chatbot.git
cd Pharmacy_Chatbot

cp .env.example .env
# Edit .env — set OPENAI_API_KEY and change JWT_SECRET_KEY
```

### 2. Start the backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
# API available at http://localhost:8000
# Swagger UI at  http://localhost:8000/docs
```

On first start, the backend automatically:
- Initialises the SQLite database and schema
- Seeds three default accounts (see [Default accounts](#default-accounts))
- Loads the FAISS index if PDFs are already in `data/pdfs/`

### 3. Ingest PDF documents

```bash
# From the project root
python backend/app/ingest.py data/pdfs/Aspirin.pdf data/pdfs/Medic.pdf
```

Or upload directly through the Admin → Documents page after logging in.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:5173
```

---

## Docker (production)

```bash
# Copy and fill in your API key
cp .env.example .env

# Build and start both services
docker compose up --build
```

The app is then available at **http://localhost:3000**.

- The backend waits to be healthy before nginx starts (health check every 15 s).
- `data/` is mounted as a volume — the database, FAISS index, and PDFs persist across restarts.
- Logs are written to `backend/logs/chatbot.log`.

To ingest PDFs into the running container:

```bash
docker compose exec backend python app/ingest.py /data/pdfs/YourFile.pdf
```

---

## Default accounts

Seeded automatically on first startup. Override passwords in `.env`.

| Role | Username | Default password | Env var |
|------|----------|-----------------|---------|
| Master Admin | `master_admin` | `MasterAdmin@123` | `MASTER_ADMIN_PASSWORD` |
| Admin | `admin` | `Admin@123` | `ADMIN_PASSWORD` |
| User | `Ahmad` | `Ahmad@123` | `AHMAD_PASSWORD` |

---

## Environment variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `OPENAI_API_KEY` | ✅ | — | OpenAI API key |
| `JWT_SECRET_KEY` | ✅ | weak default | HS256 signing secret — **change in production** |
| `MASTER_ADMIN_PASSWORD` | | `MasterAdmin@123` | Override on first seed |
| `ADMIN_PASSWORD` | | `Admin@123` | Override on first seed |
| `AHMAD_PASSWORD` | | `Ahmad@123` | Override on first seed |

---

## Project structure

```
Pharmacy_Chatbot/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, lifespan, CORS, routing
│   │   ├── config.py         # All constants: models, prompts, keywords
│   │   ├── database.py       # SQLite DAL — 9 tables, all CRUD
│   │   ├── dependencies.py   # Auth dependencies (get_current_admin, etc.)
│   │   ├── ingest.py         # PDF ingestion CLI and library
│   │   ├── routers/          # auth, user_auth, chat, documents, sessions,
│   │   │                     #   user_sessions, analytics, health
│   │   ├── schemas/          # Pydantic request / response models
│   │   └── services/
│   │       ├── rag_service.py    # FAISS index + LLM streaming
│   │       ├── auth_service.py   # JWT + bcrypt
│   │       ├── cache_service.py  # LRU response cache
│   │       └── rate_limiter.py   # Sliding-window rate limiter
│   ├── tests/                # 62 pytest tests
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Router + providers
│   │   ├── design-system.css # All CSS — pc- prefix, dark mode, responsive
│   │   ├── contexts/         # AuthContext, ThemeContext, ToastContext, LayoutContext
│   │   ├── components/
│   │   │   ├── layout/       # Sidebar, TopBar
│   │   │   └── ui/           # Icon, Card, Toast
│   │   ├── pages/            # LoginPage, DashboardPage, ChatPage,
│   │   │                     #   DocumentsPage, AnalyticsPage, AdminsPage, SettingsPage
│   │   └── services/
│   │       └── api.js        # Full API client with SSE streaming
│   ├── Dockerfile            # Multi-stage: build → nginx
│   └── nginx.conf            # SPA fallback + /api/ proxy + SSE headers
│
├── data/
│   ├── pdfs/                 # Source PDFs (Aspirin.pdf, Medic.pdf)
│   ├── pharmacy.db           # SQLite database (git-ignored)
│   ├── pharmacy.faiss        # FAISS vector index (git-ignored)
│   └── pharmacy.faiss.meta   # Index fingerprint (git-ignored)
│
├── docker-compose.yml
├── .env.example
└── .github/workflows/ci.yml
```

---

## API reference

Full interactive docs available at `http://localhost:8000/docs` (Swagger UI).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | — | Admin login → JWT |
| `GET` | `/api/auth/me` | Admin | Current admin profile |
| `POST` | `/api/auth/change-password` | Admin | Change own password |
| `GET/POST` | `/api/auth/admins` | Master Admin | List / create admin |
| `DELETE` | `/api/auth/admins/{id}` | Master Admin | Delete admin |
| `PATCH` | `/api/auth/admins/{id}/toggle` | Master Admin | Toggle active/inactive |
| `POST` | `/api/user/login` | — | User login → JWT |
| `GET` | `/api/user/me` | User | Current user profile |
| `POST` | `/api/chat` | Admin or User | Stream chat (SSE) |
| `GET/DELETE` | `/api/sessions` | Admin | List / delete chat sessions |
| `GET/DELETE` | `/api/user/sessions` | User | List / delete user sessions |
| `POST` | `/api/documents/upload` | Admin | Ingest a PDF |
| `GET` | `/api/documents` | Admin | List documents |
| `DELETE` | `/api/documents/{id}` | Admin | Delete document + chunks |
| `POST` | `/api/documents/rebuild` | Admin | Force-rebuild FAISS index |
| `GET` | `/api/analytics?period=30d` | — | Query statistics |
| `GET` | `/api/health` | — | Service status |

### Chat SSE stream format

```
POST /api/chat
{ "message": "...", "history": [...], "session_id": null }

# Response: text/event-stream
data: {"token": "Aspirin is"}
data: {"token": "Aspirin is a non-steroidal"}
...
data: {"done": true, "content": "...\n\n*Sources: Aspirin.pdf*", "sources": ["Aspirin.pdf"], "session_id": 7}
```

---

## Testing

```bash
cd backend
pytest tests/ -v
# 62 tests — no OpenAI API key required
```

Tests cover: config validation, emergency keyword detection (EN + AR), PDF ingestion, hash deduplication, FAISS fingerprinting, analytics logging, admin CRUD, session/message CRUD, and user CRUD.

---

## Disclaimer

This application is for **informational and educational purposes only**. It does not constitute medical advice. Always consult a licensed pharmacist or physician before making any medical decision.
