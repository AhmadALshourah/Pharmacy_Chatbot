import os
import sys
import time
import logging
from collections import deque, OrderedDict
from pathlib import Path
import numpy as np
import faiss
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

if not os.getenv("OPENAI_API_KEY"):
    print("Error: OPENAI_API_KEY not found.")
    print("Create a .env file based on .env.example and add your key.")
    sys.exit(1)

from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from database import (
    init_db, get_all_chunks, get_stats, get_db_fingerprint,
    log_query, get_analytics_summary,
)
from config import (
    ROOT_DIR,
    EMBEDDING_MODEL, CHAT_MODEL, CHAT_TEMPERATURE, RETRIEVAL_TOP_K,
    SYSTEM_PROMPT,
    EMERGENCY_KEYWORDS, EMERGENCY_RESPONSE,
    FAISS_INDEX_PATH, FAISS_META_PATH,
    MAX_QUERY_LENGTH, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW,
    CACHE_MAX_SIZE,
)
from ingest import process_file

# ── #19 Logging ───────────────────────────────────────────────────────────────

LOG_DIR = ROOT_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

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

# ── Startup ───────────────────────────────────────────────────────────────────

init_db()

doc_count, chunk_count = get_stats()
if chunk_count == 0:
    log.error("No documents in database. Run: python ingest.py")
    sys.exit(1)

log.info(f"Database: {doc_count} doc(s), {chunk_count} chunks")

rows     = get_all_chunks()
contents = [r[1] for r in rows]
sources  = [r[3] for r in rows]

# ── FAISS Persistence ─────────────────────────────────────────────────────────

def _build_and_save_index(all_rows):
    vectors = [np.frombuffer(r[2], dtype=np.float32) for r in all_rows]
    matrix  = np.vstack(vectors)
    faiss.normalize_L2(matrix)
    idx = faiss.IndexFlatIP(matrix.shape[1])
    idx.add(matrix)
    faiss.write_index(idx, str(FAISS_INDEX_PATH))
    FAISS_META_PATH.write_text(get_db_fingerprint())
    return idx

fingerprint = get_db_fingerprint()
if (
    FAISS_INDEX_PATH.exists()
    and FAISS_META_PATH.exists()
    and FAISS_META_PATH.read_text().strip() == fingerprint
):
    log.info("Loading FAISS index from cache...")
    index = faiss.read_index(str(FAISS_INDEX_PATH))
else:
    log.info("Building FAISS index...")
    index = _build_and_save_index(rows)

log.info(f"FAISS ready — {index.ntotal} vectors ({index.d}D)")

embeddings_model = OpenAIEmbeddings(model=EMBEDDING_MODEL)
llm = ChatOpenAI(model=CHAT_MODEL, temperature=CHAT_TEMPERATURE)

# ── Index reload (after file upload) ─────────────────────────────────────────

def _reload_index():
    global index, contents, sources, rows
    rows     = get_all_chunks()
    contents = [r[1] for r in rows]
    sources  = [r[3] for r in rows]
    index    = _build_and_save_index(rows)
    log.info(f"Index reloaded — {index.ntotal} vectors")
    return index.ntotal

# ── Emergency Detection ───────────────────────────────────────────────────────

def _is_emergency(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in EMERGENCY_KEYWORDS)

# ── Rate Limiting ─────────────────────────────────────────────────────────────

_request_times: deque = deque()

def _check_rate_limit() -> bool:
    now = time.time()
    while _request_times and now - _request_times[0] > RATE_LIMIT_WINDOW:
        _request_times.popleft()
    if len(_request_times) >= RATE_LIMIT_REQUESTS:
        log.warning("Rate limit exceeded")
        return False
    _request_times.append(now)
    return True

# ── Input Validation ──────────────────────────────────────────────────────────

def _validate(query: str) -> tuple[bool, str]:
    query = query.strip()
    if not query:
        return False, "Please enter a question."
    if len(query) > MAX_QUERY_LENGTH:
        return False, f"Question too long (max {MAX_QUERY_LENGTH} characters)."
    return True, query

# ── #27 Response Cache (LRU) ──────────────────────────────────────────────────

_cache: OrderedDict = OrderedDict()

def _cache_get(key: str):
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    return None

def _cache_set(key: str, value: str):
    _cache[key] = value
    _cache.move_to_end(key)
    if len(_cache) > CACHE_MAX_SIZE:
        _cache.popitem(last=False)

# ── Predict — Streaming ───────────────────────────────────────────────────────

def predict(message: str, history: list):
    valid, query = _validate(message)
    if not valid:
        yield query
        return

    if not _check_rate_limit():
        yield "Too many requests. Please wait a moment and try again."
        return

    if _is_emergency(query):
        log.warning(f"Emergency detected: {query[:60]!r}")
        log_query(len(query), None, set(), is_emergency=True, is_cached=False)
        yield EMERGENCY_RESPONSE
        return

    # #27 — cache lookup (only for context-free queries)
    cache_key = query.lower().strip()
    if not history:
        cached = _cache_get(cache_key)
        if cached:
            log.info(f"Cache hit: {cache_key[:50]!r}")
            log_query(len(query), 0, set(), is_emergency=False, is_cached=True)
            yield cached
            return

    start = time.time()
    log.info(f"Query ({len(query)} chars): {query[:100]!r}")

    try:
        query_vec = np.array(
            embeddings_model.embed_query(query), dtype=np.float32
        ).reshape(1, -1)
        faiss.normalize_L2(query_vec)
        _, idx_results = index.search(query_vec, k=RETRIEVAL_TOP_K)

        cited_sources = set()
        context_parts = []
        for i in idx_results[0]:
            if i < len(contents):
                context_parts.append(f"[Source: {sources[i]}]\n{contents[i]}")
                cited_sources.add(sources[i])
        context = "\n\n---\n\n".join(context_parts)

        messages = [
            SystemMessage(content=f"{SYSTEM_PROMPT}\n\nRelevant medical context:\n\n{context}")
        ]
        for msg in history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        messages.append(HumanMessage(content=query))

        full_response = ""
        for chunk in llm.stream(messages):
            full_response += chunk.content
            yield full_response

        source_list = ", ".join(sorted(cited_sources))
        final = f"{full_response}\n\n*Sources: {source_list}*"
        yield final

        elapsed_ms = int((time.time() - start) * 1000)
        log.info(f"Response: {elapsed_ms}ms | sources={sorted(cited_sources)}")

        # #27 — cache + #28 — analytics
        if not history:
            _cache_set(cache_key, final)
        log_query(len(query), elapsed_ms, cited_sources, is_emergency=False, is_cached=False)

    except Exception as e:
        err = str(e).lower()
        log.error(f"{type(e).__name__}: {e}")
        if "rate limit" in err or "ratelimit" in err:
            yield "The service is currently busy. Please wait a moment and try again."
        elif "authentication" in err or "api key" in err:
            yield "Authentication failed. Please check your OPENAI_API_KEY in the .env file."
        elif "timeout" in err or "connection" in err:
            yield "Connection issue. Please check your internet connection and try again."
        else:
            yield f"Something went wrong. Please try again.\n\n*Error: {type(e).__name__}*"

# ── #17 Upload Handler ────────────────────────────────────────────────────────

def _doc_summary() -> str:
    d, c = get_stats()
    return f"**{d} document(s) loaded** &nbsp;|&nbsp; {c:,} chunks indexed"

def handle_upload(file_path):
    if file_path is None:
        return "No file selected.", _doc_summary()
    filepath = Path(file_path)
    log.info(f"Upload: {filepath.name}")
    try:
        emb = OpenAIEmbeddings(model=EMBEDDING_MODEL)
        success = process_file(filepath, emb)
        if success:
            _reload_index()
            return f"✅ **{filepath.name}** added successfully!", _doc_summary()
        return f"ℹ️ **{filepath.name}** is already in the database.", _doc_summary()
    except Exception as e:
        log.error(f"Upload error: {e}")
        return f"❌ Error: {type(e).__name__}", _doc_summary()

# ── #26 Voice Input — OpenAI Whisper ─────────────────────────────────────────

def transcribe(audio_path):
    if not audio_path:
        return ""
    try:
        from openai import OpenAI
        client = OpenAI()
        with open(audio_path, "rb") as f:
            result = client.audio.transcriptions.create(model="whisper-1", file=f)
        log.info(f"Transcribed audio: {result.text[:80]!r}")
        return result.text
    except Exception as e:
        log.error(f"Transcription error: {e}")
        return ""

# ── #28 Analytics Display ─────────────────────────────────────────────────────

def _analytics_md() -> str:
    s = get_analytics_summary()
    if s["total"] == 0:
        return "_No queries recorded yet. Start chatting!_"
    cache_pct = (s["cached"] / s["total"] * 100) if s["total"] else 0
    avg_s     = f"{s['avg_ms'] / 1000:.1f}s" if s["avg_ms"] else "—"
    d, c      = get_stats()
    return (
        f"| Metric | Value |\n|--------|-------|\n"
        f"| Total Queries | {s['total']} |\n"
        f"| Cache Hit Rate | {cache_pct:.1f}% |\n"
        f"| Avg Response Time | {avg_s} |\n"
        f"| Emergencies Detected | {s['emergency']} |\n"
        f"| Documents in DB | {d} |\n"
        f"| Total Chunks | {c:,} |"
    )

# ── #20 Gradio UI ─────────────────────────────────────────────────────────────

import gradio as gr

DISCLAIMER = (
    "> ⚠️ **Disclaimer:** For **informational purposes only** — not medical advice. "
    "Always consult a licensed pharmacist or physician before any medical decision."
)

EXAMPLES = [
    "What is Aspirin used for?",
    "What are the side effects of Aspirin?",
    "What is the recommended dosage of Aspirin for adults?",
    "Can I take Aspirin with ibuprofen?",
    "ما هو الأسبرين وما استخداماته؟",
    "ما هي الجرعة الموصى بها من الأسبرين؟",
]


def _respond(message, history):
    if not message.strip():
        yield "", history
        return
    prev  = list(history)
    hist  = prev + [{"role": "user", "content": message}]
    yield "", hist
    hist  = hist + [{"role": "assistant", "content": "▌"}]
    for token in predict(message, prev):
        hist = hist[:-1] + [{"role": "assistant", "content": token}]
        yield "", hist


with gr.Blocks(title="Pharmacy Chatbot") as demo:

    gr.Markdown("# 💊 Pharmacy Chatbot")
    gr.Markdown(DISCLAIMER)

    with gr.Tabs():

        # ── Chat Tab ─────────────────────────────────────────────────────────
        with gr.Tab("💬 Chat"):
            with gr.Row():
                doc_status = gr.Markdown(_doc_summary())

            chatbot = gr.Chatbot(
                height=460,
                show_label=False,
                avatar_images=(
                    None,
                    "https://em-content.zobj.net/source/microsoft-teams/363/pill_1f48a.png",
                ),
                placeholder=(
                    "**Ask me anything about medications.**\n"
                    "I can help with dosage, side effects, contraindications, and interactions."
                ),
            )

            with gr.Row():
                msg_box = gr.Textbox(
                    placeholder="Ask about medications… (Arabic or English)",
                    show_label=False,
                    scale=4,
                    max_lines=3,
                )
                # #26 — voice input
                audio_in = gr.Audio(
                    sources=["microphone"],
                    type="filepath",
                    label="🎤",
                    scale=1,
                    min_width=80,
                )
                send_btn = gr.Button("Send ➤", variant="primary", scale=1, min_width=80)

            with gr.Row():
                gr.ClearButton([msg_box, chatbot], value="🗑 Clear")
                gr.Examples(examples=EXAMPLES, inputs=msg_box, label="Examples")

            gr.Markdown("---")
            gr.Markdown("### 📁 Add a Document")

            with gr.Row():
                upload_box    = gr.File(label="Upload PDF", file_types=[".pdf"], scale=2)
                upload_status = gr.Markdown("")

        # ── Analytics Tab ─────────────────────────────────────────────────────
        with gr.Tab("📊 Analytics"):
            gr.Markdown("### Query Statistics")
            analytics_md = gr.Markdown(_analytics_md())
            refresh_btn  = gr.Button("🔄 Refresh", variant="secondary")

    # ── Events ───────────────────────────────────────────────────────────────
    msg_box.submit(_respond, [msg_box, chatbot], [msg_box, chatbot])
    send_btn.click(_respond, [msg_box, chatbot], [msg_box, chatbot])
    upload_box.change(handle_upload, [upload_box], [upload_status, doc_status])
    audio_in.stop_recording(transcribe, [audio_in], [msg_box])
    refresh_btn.click(_analytics_md, outputs=[analytics_md])

# ── #29 Launch (Docker + HF Spaces compatible) ────────────────────────────────

demo.launch(
    server_name="127.0.0.1",
    server_port=int(os.getenv("PORT")) if os.getenv("PORT") else None,
    share=False,
    theme=gr.themes.Soft(),
)
