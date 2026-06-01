"""FastAPI application entry point for the Pharmacy Chatbot API."""

import os
import sys
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv, find_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables before anything else
load_dotenv(find_dotenv())

if not os.getenv("OPENAI_API_KEY"):
    print("Error: OPENAI_API_KEY not found.")
    print("Create a .env file based on .env.example and add your key.")
    sys.exit(1)

# Check JWT secret BEFORE importing app.config so we read from env directly
# (app.config may have been imported earlier by tests, caching the stale default)
_JWT_DEFAULT = "change-this-secret-in-production-please"
if os.getenv("JWT_SECRET_KEY", _JWT_DEFAULT) == _JWT_DEFAULT:
    print("Error: JWT_SECRET_KEY is set to the insecure default placeholder.")
    print("Set a strong random value in .env before starting the server.")
    print('Generate one with: python -c "import secrets; print(secrets.token_hex(32))"')
    sys.exit(1)

from app.config import ROOT_DIR, CORS_ORIGINS
from app.database import init_db, admin_exists, create_admin, user_exists, create_user
from app.services.rag_service import RAGService
from app.services.auth_service import hash_password
from app.ingest import auto_ingest_pdfs
from app.routers import health, chat, documents, analytics, auth, sessions, user_auth, user_sessions, admin_conversations

# ── Logging ──────────────────────────────────────────────────────────────────

LOG_DIR = ROOT_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)   # M8: parents=True prevents FileNotFoundError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_DIR / "chatbot.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)

log = logging.getLogger("pharmacy")

# ── Seed default admin accounts ──────────────────────────────────────────────

_DEFAULT_ADMINS = [
    {
        "username": "master_admin",
        "email":    "master@pharmacy.local",
        "password": os.getenv("MASTER_ADMIN_PASSWORD", "MasterAdmin@123"),
        "role":     "master_admin",
    },
    {
        "username": "admin",
        "email":    "admin@pharmacy.local",
        "password": os.getenv("ADMIN_PASSWORD", "Admin@123"),
        "role":     "admin",
    },
]


_DEFAULT_USERS = [
    {
        "username": "Ahmad",
        "email":    "ahmad@pharmacy.local",
        "password": os.getenv("AHMAD_PASSWORD", "Ahmad@123"),
    },
]


def _seed_admins():
    """Create default admin accounts if they don't already exist."""
    for a in _DEFAULT_ADMINS:
        if not admin_exists(a["username"]):
            create_admin(a["username"], a["email"], hash_password(a["password"]), a["role"])
            log.info(f"Seeded admin: {a['username']} ({a['role']})")


def _seed_users():
    """Create default user accounts if they don't already exist."""
    for u in _DEFAULT_USERS:
        if not user_exists(u["username"]):
            create_user(u["username"], u["email"], hash_password(u["password"]))
            log.info(f"Seeded user: {u['username']}")


# ── Application lifespan ─────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, seed admins and users, auto-ingest PDFs, load RAG service."""
    init_db()
    _seed_admins()
    _seed_users()
    auto_ingest_pdfs()

    rag = RAGService()
    rag.initialize()
    app.state.rag_service = rag
    yield


# ── FastAPI app ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Pharmacy Chatbot API",
    description="RAG-powered pharmacy assistant API with streaming chat, "
                "document management, and analytics.",
    version="2.0.0",
    lifespan=lifespan,
)

# C5: CORS origins from CORS_ORIGINS env var (comma-separated).
# Default covers localhost dev only. In production set e.g.:
#   CORS_ORIGINS=https://aspira.example.com
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ──────────────────────────────────────────────────────────

app.include_router(auth.router,           prefix="/api")
app.include_router(health.router,         prefix="/api")
app.include_router(chat.router,           prefix="/api")
app.include_router(documents.router,      prefix="/api")
app.include_router(analytics.router,      prefix="/api")
app.include_router(sessions.router,       prefix="/api")
app.include_router(user_auth.router,      prefix="/api")
app.include_router(user_sessions.router,         prefix="/api")
app.include_router(admin_conversations.router,   prefix="/api")
