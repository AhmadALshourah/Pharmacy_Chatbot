import os
from pathlib import Path

# backend/app/ → backend/ → project root
ROOT_DIR = Path(__file__).parent.parent
DATA_DIR = ROOT_DIR.parent / "data"
PDFS_DIR = DATA_DIR / "pdfs"

# ── Authentication ────────────────────────────────────────────────────────────
_JWT_DEFAULT = "change-this-secret-in-production-please"
JWT_SECRET_KEY     = os.getenv("JWT_SECRET_KEY", _JWT_DEFAULT)
JWT_SECRET_IS_WEAK = JWT_SECRET_KEY == _JWT_DEFAULT
JWT_ALGORITHM      = "HS256"
JWT_EXPIRE_MINUTES = 60 * 8   # 8 hours

# ── CORS ──────────────────────────────────────────────────────────────────────
# Comma-separated list of allowed origins. Override via CORS_ORIGINS env var.
_DEFAULT_CORS = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000"
CORS_ORIGINS: list[str] = [
    o.strip() for o in os.getenv("CORS_ORIGINS", _DEFAULT_CORS).split(",") if o.strip()
]

# ── Upload limits ─────────────────────────────────────────────────────────────
MAX_UPLOAD_BYTES = 20 * 1024 * 1024   # 20 MB

# ── FAISS cache (#8) ──────────────────────────────────────────────────────────
FAISS_INDEX_PATH = DATA_DIR / "pharmacy.faiss"
FAISS_META_PATH  = DATA_DIR / "pharmacy.faiss.meta"

# ── Models ────────────────────────────────────────────────────────────────────
# WARNING: changing EMBEDDING_MODEL requires re-running `python ingest.py`
# to rebuild embeddings — mixing models breaks similarity search.
EMBEDDING_MODEL    = "text-embedding-ada-002"
CHAT_MODEL         = "gpt-4o-mini"
CHAT_TEMPERATURE   = 0.3
RETRIEVAL_TOP_K    = 4

# ── System prompt (#7 + #11) ──────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a knowledgeable and careful pharmacy assistant. Your responsibilities:

**Medication Information**
- Provide accurate information about drugs: uses, dosage, side effects, contraindications, storage.
- Base all answers strictly on the provided medical documents.
- If the documents do not contain the answer, say so clearly — do not guess.

**Drug Interactions (#11)**
- When a user asks about combining two or more medications, explicitly check for interactions.
- Flag any known interaction with: ⚠️ WARNING: [description of risk and severity].
- Always recommend consulting a pharmacist or physician before combining medications.

**Safety Rules (never break these)**
- Never diagnose medical conditions.
- Always end answers with a reminder to consult a licensed pharmacist or doctor.
- Respond in the same language the user writes in (Arabic or English)."""

# ── Emergency detection (#10) ─────────────────────────────────────────────────
# ── Input validation (#21) ────────────────────────────────────────────────────
MAX_QUERY_LENGTH    = 2000   # characters
RATE_LIMIT_REQUESTS = 20     # max requests
RATE_LIMIT_WINDOW   = 60     # per N seconds

# ── Response caching (#27) ───────────────────────────────────────────────────
CACHE_MAX_SIZE = 100         # max cached responses (LRU)

# ── Emergency keywords (#10 + #14 Arabic) ────────────────────────────────────
EMERGENCY_KEYWORDS = [
    # Overdose (EN)
    "overdose", "took too many", "too many pills", "too many tablets",
    "took too much", "accidental ingestion", "accidentally swallowed",
    # Poisoning (EN)
    "poisoning", "poisoned", "toxic",
    # Self-harm (EN)
    "want to die", "kill myself", "suicide", "suicidal", "end my life",
    "hurt myself",
    # Severe reactions (EN)
    "anaphylaxis", "severe allergic", "allergic shock",
    "can't breathe", "cannot breathe", "difficulty breathing",
    "throat closing", "throat swelling", "not breathing", "stop breathing",
    # Cardiac (EN)
    "chest pain", "heart attack",
    # Consciousness (EN)
    "unconscious", "unresponsive", "passed out", "fainted", "collapsed",
    # Arabic (#14)
    "جرعة زائدة", "تسمم", "أريد أن أموت", "انتحار", "أقتل نفسي",
    "لا أستطيع التنفس", "صعوبة في التنفس", "فقدان الوعي", "حساسية شديدة",
    "ألم في الصدر", "نوبة قلبية", "ابتلع", "تناولت كثيراً",
]

EMERGENCY_RESPONSE = """\
🚨 **This sounds like a medical emergency.**

**Call emergency services immediately:**
| Region | Number |
|--------|--------|
| International | **112** |
| USA | **911** |
| UK | **999** / NHS: **111** |
| Jordan | **911** / Civil Defense: **191** |

**Poison Control (accidental medication ingestion):**
- USA: **1-800-222-1222**
- UK: **111** (NHS)

**Do not wait — get professional help right now.**

*I am an AI assistant and cannot provide emergency medical care.*"""
