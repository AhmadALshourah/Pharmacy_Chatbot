# Pharmacy Chatbot — Improvement Ideas

---

## CRITICAL

### 1. Load All PDF Documents ✅ DONE
Replaced direct PDF reading with SQLite (`pharmacy.db`). `ingest.py` loads all PDFs
and stores chunks + embeddings. Both `Aspirin.pdf` and `Medic.pdf` are ingested.

### 2. Fix Conversation History (Memory) ✅ DONE
`predict()` now builds a full message chain: `SystemMessage → [history] → HumanMessage`.
The LLM receives the entire conversation context, enabling proper follow-up questions.

### 3. Fix Deprecated LangChain Imports ✅ DONE
All imports updated to `langchain_openai` (the canonical package):
- `from langchain_openai import OpenAIEmbeddings, ChatOpenAI`
- `from langchain_core.documents import Document`
- `from langchain_core.messages import SystemMessage, HumanMessage, AIMessage`
Upgraded: langchain 1.3.1, langchain-openai 1.2.2, openai 2.38.0

### 4. Add `requirements.txt` ✅ DONE
`requirements.txt` with pinned versions for all 10 dependencies.

### 5. Add `.env.example` + API Key Validation ✅ DONE
`.env.example` template added. `Chatbot.py` validates `OPENAI_API_KEY` at startup
and exits with a clear message if missing.

### 6. Fix pyttsx3 Blocking Bug ✅ DONE
`pyttsx3` removed entirely from the project. TTS can be re-added as an optional
feature (see MEDIUM ideas) without the blocking issue.

---

## HIGH

### 7. Add a Pharmacy-Specific System Prompt ✅ DONE
`config.py → SYSTEM_PROMPT` instructs the LLM to: answer only from medical documents,
always add disclaimers, refuse diagnosis, respond in user's language, flag drug interactions.

### 8. Persist the FAISS Index to Disk ✅ DONE
`pharmacy.faiss` + `pharmacy.faiss.meta` (fingerprint) saved on first build.
On startup: loads from cache if DB unchanged, rebuilds automatically if new docs were added.
`ingest.py` deletes the cache files after ingesting new documents to force a rebuild.

### 9. Add Source Citations ✅ DONE
Every response ends with `*Sources: filename.pdf*` showing which documents were used.

### 10. Emergency Detection ✅ DONE
`config.py → EMERGENCY_KEYWORDS` (33 keywords covering overdose, poisoning, self-harm,
severe allergic reactions, cardiac events). Checked first in `predict()` before any API call.
Returns `EMERGENCY_RESPONSE` with emergency numbers for international, USA, UK, Jordan.

### 11. Drug Interaction Warnings ✅ DONE
Built into `SYSTEM_PROMPT`: LLM is explicitly instructed to flag interactions with
⚠️ WARNING and severity when user asks about combining medications.

### 12. Proper Error Handling ✅ DONE
- `ingest.py`: try/except around PDF reading, embedding generation, and DB insert.
  Shows friendly messages for each failure type (unreadable PDF, API error, DB error).
- `Chatbot.py`: try/except in `predict()` with specific messages for rate limits,
  authentication failures, connection issues, and generic errors.

### 13. Modular Project Structure ✅ DONE
```
Pharmacy_Chatbot/
├── Chatbot.py       # Gradio UI + predict() — lean, imports from modules below
├── config.py        # All settings: models, prompts, keywords, paths
├── database.py      # SQLite layer: schema, CRUD, fingerprint
├── ingest.py        # CLI ingestion tool
├── pharmacy.db      # SQLite database (documents + chunks + embeddings)
├── pharmacy.faiss   # Cached FAISS index (auto-rebuilt when DB changes)
├── requirements.txt
├── .env.example
└── ideas.md
```

---

## MEDIUM

### 14. Multi-Language Support (Arabic + English) ✅ DONE
- System prompt instructs LLM to respond in the user's language (EN/AR).
- `config.py → EMERGENCY_KEYWORDS` now includes 13 Arabic emergency phrases,
  bringing the total to 46 keywords covering both languages.
- Arabic examples added to the Gradio UI.

### 15. Streaming Responses ✅ DONE
- `predict()` now uses `llm.stream()` — tokens are yielded one by one to the UI.
- `_respond()` in Gradio Blocks updates the chatbot message incrementally.
- A `▌` cursor is shown while the response is generating.

### 16. Improve Chunking Strategy ✅ DONE (was already done)
`RecursiveCharacterTextSplitter` with smart separators `["\n\n", "\n", ". ", " ", ""]`
was already in place from the SQLite phase.

### 17. Add More Knowledge Sources ✅ DONE
- Gradio UI now has a **Upload PDF** section at the bottom.
- `handle_upload()` runs the full ingest pipeline and reloads the FAISS index
  in-memory — no restart required.
- Document count updates live in the UI after each upload.

### 18. Make TTS Optional (Toggle) — SKIPPED
pyttsx3 was removed intentionally (blocking bug). TTS can be re-added later
as a non-blocking optional feature using a background thread.

### 19. Add Logging ✅ DONE
Python `logging` module writing to both:
- Console (INFO+)
- `logs/chatbot.log` (UTF-8, includes Arabic queries)
Logs: query text (truncated), response time, sources used, emergency detections,
upload events, rate limit warnings, and all errors with exception type.

### 20. Enhance the Gradio UI ✅ DONE
Switched from `ChatInterface` to `gr.Blocks(theme=gr.themes.Soft())`:
- Disclaimer banner at the top
- Live document count display
- Pill avatar for the assistant
- Multi-line input box
- Arabic + English example questions
- Upload PDF section with live status feedback
- Clear chat button

### 21. Rate Limiting + Input Validation ✅ DONE
- **Validation**: strips whitespace, rejects empty queries, rejects queries > 2000 chars.
- **Rate limiting**: sliding window — max 20 requests per 60 seconds globally.
  Configurable via `config.py → RATE_LIMIT_REQUESTS / RATE_LIMIT_WINDOW`.

### 22. Replace OpenAI with Local/Free Model — SKIPPED
Out of scope for this phase. Would require Ollama + model download (~4GB+).
Can be added as a config toggle later.

---

## LOW

### 23. Add Unit + Integration Tests ✅ DONE
36 tests across `tests/test_config.py` (21) and `tests/test_database.py` (15).
Isolated per-test SQLite DB via `monkeypatch`. Zero OpenAI API calls required.

### 24. Docker Support ✅ DONE
`Dockerfile` (python:3.12-slim), `docker-compose.yml` (volumes for DB, FAISS index,
logs), `.dockerignore` (excludes .venv, .env, __pycache__, .git, tests).
One-command startup: `docker compose up --build`.

### 25. Add a README.md ✅ DONE
`README.md` with badges, architecture ASCII diagram, quick start, Docker instructions,
`ingest.py` CLI reference, configuration table, project structure tree, tech stack
table, deployment guide, and disclaimer.

### 26. Voice Input (Speech-to-Text) ✅ DONE
Microphone button in the Gradio UI feeds audio to `transcribe()` via OpenAI Whisper
(`whisper-1`). Transcript auto-fills the text box.

### 27. Caching Responses ✅ DONE
LRU cache via `OrderedDict` (max 100 entries, configurable). Cache key is the
lowercased query. Only context-free queries (empty history) are cached.
Cache hits bypass FAISS + LLM — logged to analytics.

### 28. Analytics Dashboard ✅ DONE
`analytics` SQLite table records every query (length, response ms, sources,
emergency flag, cache flag). Gradio **Analytics** tab shows totals, cache hit rate,
avg response time, emergency count, doc/chunk counts. Refresh button updates live.

### 29. Deployment to Cloud ✅ DONE
`demo.launch(server_name="0.0.0.0", server_port=int(os.getenv("PORT", 7860)))`
is HF Spaces and Docker compatible. README includes HF Spaces deployment steps.

### 30. CI/CD Pipeline ✅ DONE
`.github/workflows/ci.yml` — runs on push/PR to main:
- Python 3.12, pip cache
- `ruff check .` linting
- `pytest tests/ -v` (36 tests, no API key needed)
