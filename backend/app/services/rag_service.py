"""Core RAG (Retrieval-Augmented Generation) service.

Manages the FAISS vector index, query embedding, context retrieval,
and LLM streaming for the pharmacy chatbot.
"""

import time
import logging
from typing import Generator

import numpy as np
import faiss
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from app.config import (
    EMBEDDING_MODEL, CHAT_MODEL, CHAT_TEMPERATURE, RETRIEVAL_TOP_K,
    SYSTEM_PROMPT,
    EMERGENCY_KEYWORDS, EMERGENCY_RESPONSE,
    FAISS_INDEX_PATH, FAISS_META_PATH,
    MAX_QUERY_LENGTH,
)
from app.database import (
    init_db, get_all_chunks, get_stats, get_db_fingerprint,
    log_query,
)
from app.services.cache_service import CacheService
from app.services.rate_limiter import RateLimiter

log = logging.getLogger("pharmacy")


class RAGService:
    """Retrieval-Augmented Generation service for the pharmacy chatbot."""

    def __init__(self):
        self.index: faiss.IndexFlatIP | None = None
        self.contents: list[str] = []
        self.sources: list[str] = []
        self.embeddings_model: OpenAIEmbeddings | None = None
        self.llm: ChatOpenAI | None = None
        self.cache = CacheService()
        self.rate_limiter = RateLimiter()
        self._initialized = False

    def initialize(self) -> None:
        """Initialize DB, load FAISS index, and set up LLM clients.

        Must be called once at startup (e.g., in FastAPI lifespan).
        """
        init_db()

        doc_count, chunk_count = get_stats()
        if chunk_count == 0:
            log.warning("No documents in database. Run: python -m app.ingest")
            # Don't exit — API can still serve health/upload endpoints
            self._initialized = True
            return

        log.info(f"Database: {doc_count} doc(s), {chunk_count} chunks")

        rows = get_all_chunks()
        self.contents = [r[1] for r in rows]
        self.sources = [r[3] for r in rows]

        # FAISS index: load from cache or build
        fingerprint = get_db_fingerprint()
        if (
            FAISS_INDEX_PATH.exists()
            and FAISS_META_PATH.exists()
            and FAISS_META_PATH.read_text().strip() == fingerprint
        ):
            log.info("Loading FAISS index from cache...")
            self.index = faiss.read_index(str(FAISS_INDEX_PATH))
        else:
            log.info("Building FAISS index...")
            self.index = self._build_and_save_index(rows)

        log.info(f"FAISS ready — {self.index.ntotal} vectors ({self.index.d}D)")

        self.embeddings_model = OpenAIEmbeddings(model=EMBEDDING_MODEL)
        self.llm = ChatOpenAI(model=CHAT_MODEL, temperature=CHAT_TEMPERATURE)
        self._initialized = True

    @property
    def is_ready(self) -> bool:
        """Whether the service is initialized and has documents loaded."""
        return self._initialized and self.index is not None

    def _build_and_save_index(self, all_rows) -> faiss.IndexFlatIP:
        """Build a FAISS index from chunk embeddings and persist to disk."""
        vectors = [np.frombuffer(r[2], dtype=np.float32) for r in all_rows]
        matrix = np.vstack(vectors)
        faiss.normalize_L2(matrix)
        idx = faiss.IndexFlatIP(matrix.shape[1])
        idx.add(matrix)
        FAISS_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(idx, str(FAISS_INDEX_PATH))
        FAISS_META_PATH.write_text(get_db_fingerprint())
        return idx

    def reload_index(self) -> int:
        """Reload FAISS index after new documents are ingested.

        Returns the total number of vectors in the index.
        """
        rows = get_all_chunks()
        self.contents = [r[1] for r in rows]
        self.sources = [r[3] for r in rows]
        self.index = self._build_and_save_index(rows)

        # Re-init models if first document was just added
        if self.embeddings_model is None:
            self.embeddings_model = OpenAIEmbeddings(model=EMBEDDING_MODEL)
        if self.llm is None:
            self.llm = ChatOpenAI(model=CHAT_MODEL, temperature=CHAT_TEMPERATURE)

        log.info(f"Index reloaded — {self.index.ntotal} vectors")
        self.cache.clear()
        return self.index.ntotal

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def is_emergency(text: str) -> bool:
        """Check if the query contains emergency keywords."""
        lower = text.lower()
        return any(kw in lower for kw in EMERGENCY_KEYWORDS)

    @staticmethod
    def validate(query: str) -> tuple[bool, str]:
        """Validate and sanitize user input."""
        query = query.strip()
        if not query:
            return False, "Please enter a question."
        if len(query) > MAX_QUERY_LENGTH:
            return False, f"Question too long (max {MAX_QUERY_LENGTH} characters)."
        return True, query

    # ── Main prediction (streaming generator) ────────────────────────────────

    def predict(
        self,
        message: str,
        history: list[dict],
        admin_id: int | None = None,
        rate_limit_key: str = "global",
    ) -> Generator[str | dict, None, None]:
        """Generate a streaming response for the given message.

        Yields cumulative response text as tokens arrive from the LLM.
        The final yield includes source citations appended.

        Args:
            message:         The user's question.
            history:         Prior messages [{"role": "user"|"assistant", ...}].
            admin_id:        Admin ID for analytics attribution (None for users).
            rate_limit_key:  Per-principal key for the rate limiter (e.g. "admin_1").

        Yields:
            Cumulative response text (each yield replaces the previous).
        """
        # Validate input
        valid, query = self.validate(message)
        if not valid:
            yield query
            return

        # C4: per-principal rate limit so one caller cannot starve others
        if not self.rate_limiter.check(key=rate_limit_key):
            yield "Too many requests. Please wait a moment and try again."
            return

        # Emergency detection
        if self.is_emergency(query):
            log.warning(f"Emergency detected: {query[:60]!r}")
            log_query(len(query), None, set(), is_emergency=True, is_cached=False, admin_id=admin_id)
            yield EMERGENCY_RESPONSE
            return

        # Service readiness check
        if not self.is_ready:
            yield "No documents loaded. Please upload a PDF first."
            return

        # Cache lookup (only for context-free queries)
        cache_key = query.lower().strip()
        if not history:
            cached = self.cache.get(cache_key)
            if cached:
                log.info(f"Cache hit: {cache_key[:50]!r}")
                log_query(len(query), 0, set(), is_emergency=False, is_cached=True, admin_id=admin_id)
                yield cached
                return

        start = time.time()
        log.info(f"Query ({len(query)} chars): {query[:100]!r}")

        try:
            # Embed the query
            query_vec = np.array(
                self.embeddings_model.embed_query(query), dtype=np.float32
            ).reshape(1, -1)
            faiss.normalize_L2(query_vec)
            _, idx_results = self.index.search(query_vec, k=RETRIEVAL_TOP_K)

            # Build context from retrieved chunks
            cited_sources = set()
            context_parts = []
            for i in idx_results[0]:
                if i < len(self.contents):
                    context_parts.append(f"[Source: {self.sources[i]}]\n{self.contents[i]}")
                    cited_sources.add(self.sources[i])
            context = "\n\n---\n\n".join(context_parts)

            # Build LLM messages
            messages = [
                SystemMessage(content=f"{SYSTEM_PROMPT}\n\nRelevant medical context:\n\n{context}")
            ]
            for msg in history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))
            messages.append(HumanMessage(content=query))

            # Stream response
            full_response = ""
            for chunk in self.llm.stream(messages):
                full_response += chunk.content
                yield full_response

            # L12: yield a structured sentinel as the last item so the router
            # never needs to parse "*Sources:*" back out of plain text.
            source_list = ", ".join(sorted(cited_sources))
            final = f"{full_response}\n\n*Sources: {source_list}*"
            yield {"type": "done", "content": final, "sources": sorted(cited_sources)}

            elapsed_ms = int((time.time() - start) * 1000)
            log.info(f"Response: {elapsed_ms}ms | sources={sorted(cited_sources)}")

            # Cache stores the formatted string (with citations appended)
            if not history:
                self.cache.set(cache_key, final)
            log_query(len(query), elapsed_ms, cited_sources, is_emergency=False, is_cached=False, admin_id=admin_id)

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
