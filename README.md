# 💊 Pharmacy Chatbot

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![LangChain](https://img.shields.io/badge/LangChain-1.3-green)](https://python.langchain.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai)](https://openai.com)
[![Gradio](https://img.shields.io/badge/Gradio-5.x-orange)](https://gradio.app)
[![FAISS](https://img.shields.io/badge/FAISS-1.9-red)](https://github.com/facebookresearch/faiss)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-36%20passing-brightgreen)](#testing)

An AI-powered pharmacy assistant that answers medication questions in **Arabic and English**, detects medical emergencies, flags drug interactions, and streams answers in real time — all grounded in your own PDF documents.

---

## Features

- **RAG pipeline** — answers are grounded in ingested pharmacy PDFs, not hallucinated
- **Bilingual** — responds in the same language the user writes in (Arabic / English)
- **Emergency detection** — 46 keywords (EN + AR) trigger an immediate emergency-numbers response before any LLM call
- **Drug interaction warnings** — system prompt instructs the LLM to flag ⚠️ interactions
- **Streaming responses** — tokens appear word-by-word via `llm.stream()`
- **Voice input** — speak questions via microphone (OpenAI Whisper)
- **PDF upload at runtime** — add new documents without restarting the server
- **LRU response cache** — repeated queries skip the LLM entirely
- **Rate limiting** — sliding-window guard (20 req / 60 s)
- **Analytics dashboard** — total queries, cache hit rate, average response time
- **Persistent FAISS index** — rebuilt automatically only when the document DB changes
- **Structured logging** — UTF-8 log file + console (supports Arabic query text)

---

## Architecture

```
User (Gradio UI)
       │
       ▼
  ┌─────────────┐    emergency?   ┌─────────────────────┐
  │  predict()  │──────────────▶ │  EMERGENCY_RESPONSE │
  └──────┬──────┘                └─────────────────────┘
         │ cached?
         ▼
  ┌─────────────┐
  │  LRU Cache  │──hit──▶ return cached answer
  └──────┬──────┘
         │ miss
         ▼
  ┌──────────────────┐
  │ OpenAI Embeddings│  (text-embedding-ada-002)
  └──────┬───────────┘
         │ query vector
         ▼
  ┌──────────────┐
  │  FAISS Index │  cosine similarity (IndexFlatIP + L2 norm)
  └──────┬───────┘
         │ top-K chunks
         ▼
  ┌──────────────────────────────────┐
  │  ChatOpenAI (gpt-4o-mini)        │
  │  SystemMessage + history +       │
  │  retrieved context + user query  │
  └──────┬───────────────────────────┘
         │ streaming tokens
         ▼
  Gradio Chatbot  +  SQLite analytics log

SQLite (pharmacy.db)
  ├── documents  (filename, hash, size, pages)
  ├── chunks     (content, embedding blob, FK → documents)
  └── analytics  (query_len, response_ms, sources, flags)
```

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/your-username/pharmacy-chatbot.git
cd pharmacy-chatbot
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure your API key

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...
```

### 3. Ingest your documents

```bash
python ingest.py Aspirin.pdf Medic.pdf
# or ingest an entire folder:
python ingest.py --dir ./documents
```

### 4. Run the chatbot

```bash
python Chatbot.py
# Open http://localhost:7860
```

---

## Docker

```bash
# Build and start (requires .env with OPENAI_API_KEY)
docker compose up --build

# Ingest documents into the running container
docker compose exec chatbot python ingest.py Aspirin.pdf
```

The database, FAISS index, and logs are mounted as volumes and persist between restarts.

---

## `ingest.py` CLI Reference

```
python ingest.py [FILES ...]        Ingest one or more PDF files
python ingest.py --dir PATH         Ingest all PDFs in a directory
python ingest.py --list             List documents currently in the database
python ingest.py --delete FILENAME  Remove a document and its chunks
```

Files already in the database (matched by SHA-256 hash) are skipped automatically. Re-ingesting a file with the same name but different content replaces it atomically.

---

## Configuration (`config.py`)

| Setting | Default | Description |
|---------|---------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-ada-002` | OpenAI embedding model — **must match ingested data** |
| `CHAT_MODEL` | `gpt-4o-mini` | OpenAI chat model |
| `CHAT_TEMPERATURE` | `0.3` | Lower = more deterministic answers |
| `RETRIEVAL_TOP_K` | `4` | Number of chunks retrieved per query |
| `MAX_QUERY_LENGTH` | `2000` | Characters — longer queries are rejected |
| `RATE_LIMIT_REQUESTS` | `20` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60` | Sliding window in seconds |
| `CACHE_MAX_SIZE` | `100` | LRU cache capacity (responses) |

> **Warning:** Changing `EMBEDDING_MODEL` requires re-running `python ingest.py` to rebuild all embeddings. Mixing embedding models breaks similarity search.

---

## Project Structure

```
Pharmacy_Chatbot/
├── Chatbot.py          # Gradio app, predict(), streaming, voice, upload
├── config.py           # All settings: models, prompts, keywords, paths
├── database.py         # SQLite layer: schema, CRUD, fingerprint, analytics
├── ingest.py           # CLI ingestion tool (PDF → chunks → embeddings → DB)
├── requirements.txt
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── tests/
│   ├── conftest.py     # tmp_db fixture (isolated SQLite per test)
│   ├── test_config.py  # Emergency detection, validation, config sanity (21 tests)
│   └── test_database.py # DB CRUD, deduplication, fingerprint, analytics (15 tests)
├── pharmacy.db         # SQLite database (git-ignored in production)
├── pharmacy.faiss      # Cached FAISS index (auto-rebuilt on DB change)
└── logs/
    └── chatbot.log
```

---

## Testing

```bash
pip install pytest
pytest tests/ -v
# 36 tests — no OpenAI API calls required
```

Tests use an isolated in-memory SQLite database via `monkeypatch` — no API key needed.

---

## Tech Stack

| Layer | Library |
|-------|---------|
| LLM | `langchain-openai` → `gpt-4o-mini` |
| Embeddings | `langchain-openai` → `text-embedding-ada-002` |
| Vector search | `faiss-cpu` (IndexFlatIP + L2 normalization) |
| Storage | `sqlite3` (stdlib) with WAL mode |
| PDF parsing | `PyPDF2` |
| Chunking | `langchain-text-splitters` RecursiveCharacterTextSplitter |
| UI | `gradio` 5.x Blocks |
| Voice STT | OpenAI Whisper API |
| Config | `python-dotenv` |

---

## Deployment

### Hugging Face Spaces

1. Create a new Space (SDK: Gradio, hardware: CPU Basic)
2. Push this repository
3. Add `OPENAI_API_KEY` in Space → Settings → Repository secrets
4. The app launches automatically on port 7860

The `demo.launch(server_name="0.0.0.0", server_port=int(os.getenv("PORT", 7860)))` call is already compatible with HF Spaces.

---

## Disclaimer

> This chatbot is for **informational purposes only** and does not constitute medical advice. Always consult a licensed pharmacist or physician before making any medical decision.
