"""Chat endpoint with SSE streaming, auth, and session persistence."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.dependencies import get_current_principal
from app.schemas.chat import ChatRequest
from app.database import (
    create_chat_session,
    get_chat_session,
    add_chat_message,
    create_user_session,
    get_user_session,
    add_user_message,
)

log = logging.getLogger("pharmacy")

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat(
    request: Request,
    body: ChatRequest,
    principal: dict = Depends(get_current_principal),
):
    """Stream a chatbot response via Server-Sent Events (SSE).

    Accepts tokens from both admin and user accounts.  Creates a new session
    when ``session_id`` is omitted; appends to the existing session otherwise.

    SSE event format:
        data: {"token": "cumulative text..."}\n\n
        data: {"done": true, "content": "...", "sources": [...], "session_id": N}\n\n
        data: {"error": "message"}\n\n
    """
    rag_service = request.app.state.rag_service
    is_admin = principal["principal_type"] == "admin"
    principal_id = principal["id"]

    # Pick the right session functions based on principal type
    if is_admin:
        _create_session = create_chat_session   # (admin_id, title) -> int
        _get_session    = get_chat_session       # (session_id)      -> dict | None
        _add_message    = add_chat_message       # (session_id, role, content) -> int
        _owner_key      = "admin_id"
    else:
        _create_session = create_user_session    # (user_id, title)  -> int
        _get_session    = get_user_session       # (session_id)      -> dict | None
        _add_message    = add_user_message       # (session_id, role, content) -> int
        _owner_key      = "user_id"

    # ── Resolve or create session ────────────────────────────────────────────
    if body.session_id is not None:
        session = _get_session(body.session_id)
        if session is None or session[_owner_key] != principal_id:
            raise HTTPException(status_code=403, detail="Session not found or access denied.")
        session_id = body.session_id
    else:
        title = body.message[:60].strip() or "New Chat"
        session_id = _create_session(principal_id, title)

    # Save user message before streaming starts
    _add_message(session_id, "user", body.message)

    # Analytics: only attribute to admin_id when the caller is an admin
    admin_id = principal_id if is_admin else None
    history  = [msg.model_dump() for msg in body.history]

    def event_stream():
        last_token = ""
        try:
            for token in rag_service.predict(body.message, history, admin_id=admin_id):
                last_token = token
                event = json.dumps({"token": token}, ensure_ascii=False)
                yield f"data: {event}\n\n"

            # Persist the full assistant response
            _add_message(session_id, "assistant", last_token)

            sources: list[str] = []
            if "*Sources:" in last_token:
                parts = last_token.rsplit("*Sources:", 1)
                if len(parts) == 2:
                    source_text = parts[1].strip().rstrip("*")
                    sources = [s.strip() for s in source_text.split(",") if s.strip()]

            done_event = json.dumps(
                {
                    "done": True,
                    "content": last_token,
                    "sources": sources,
                    "session_id": session_id,
                },
                ensure_ascii=False,
            )
            yield f"data: {done_event}\n\n"

        except Exception as e:
            log.error(f"SSE stream error: {type(e).__name__}: {e}")
            error_event = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {error_event}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
