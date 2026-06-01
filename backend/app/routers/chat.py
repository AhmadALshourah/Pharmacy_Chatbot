"""Chat endpoint with SSE streaming, auth, and session persistence."""

import base64
import json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.config import (
    ALLOWED_IMAGE_MIME,
    MAX_IMAGES_PER_MESSAGE,
    MAX_IMAGE_BYTES,
)
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

# data:<mime>;base64,<payload>
_DATA_URL_RE = re.compile(r"^data:([\w./+-]+);base64,(.+)$", re.DOTALL)


def _validate_images(images: list[str]) -> None:
    """Reject images that exceed the count, mime, or decoded-byte limits.

    Raises HTTPException(400) on the first violation so the client gets a
    clear error before we spend tokens on a vision call.
    """
    if not images:
        return
    if len(images) > MAX_IMAGES_PER_MESSAGE:
        raise HTTPException(
            status_code=400,
            detail=f"Too many images — max {MAX_IMAGES_PER_MESSAGE} per message.",
        )
    for i, data_url in enumerate(images):
        match = _DATA_URL_RE.match(data_url or "")
        if not match:
            raise HTTPException(
                status_code=400,
                detail=f"Image #{i + 1} is not a valid base64 data URL.",
            )
        mime, payload = match.group(1).lower(), match.group(2)
        if mime not in ALLOWED_IMAGE_MIME:
            raise HTTPException(
                status_code=400,
                detail=f"Image #{i + 1} type '{mime}' is not allowed.",
            )
        # Decoded size = len(payload) * 3 / 4 (minus padding). Cheap to compute
        # without actually decoding — we just want an upper bound.
        padding = payload.count("=", -2)
        approx_bytes = (len(payload) * 3) // 4 - padding
        if approx_bytes > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Image #{i + 1} is too large "
                    f"({approx_bytes // 1024} KB; max "
                    f"{MAX_IMAGE_BYTES // 1024} KB)."
                ),
            )
        # Sanity-check that the payload actually decodes — guards against
        # malformed strings that would later blow up inside the LLM client.
        try:
            base64.b64decode(payload[: min(len(payload), 1024)], validate=True)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Image #{i + 1} has invalid base64 payload.",
            ) from exc


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

    # Validate image attachments before we touch the DB or the LLM
    _validate_images(body.images)

    # Pick the right session functions based on principal type
    if is_admin:
        _create_session = create_chat_session   # (admin_id, title) -> int
        _get_session    = get_chat_session       # (session_id)      -> dict | None
        _add_message    = add_chat_message       # (session_id, role, content, images) -> int
        _owner_key      = "admin_id"
    else:
        _create_session = create_user_session    # (user_id, title)  -> int
        _get_session    = get_user_session       # (session_id)      -> dict | None
        _add_message    = add_user_message       # (session_id, role, content, images) -> int
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

    # Save user message before streaming starts (with its image attachments)
    _add_message(session_id, "user", body.message, body.images)

    # Analytics: only attribute to admin_id when the caller is an admin
    admin_id = principal_id if is_admin else None
    # C4: per-principal key so each user has their own rate-limit window
    rate_limit_key = f"{'admin' if is_admin else 'user'}_{principal_id}"
    history = [msg.model_dump() for msg in body.history]
    request_images = list(body.images)

    def event_stream():
        last_content = ""
        final_sources: list[str] = []
        try:
            for item in rag_service.predict(
                body.message, history,
                admin_id=admin_id,
                rate_limit_key=rate_limit_key,
                images=request_images,
            ):
                # L12: last yield is a structured dict — everything else is a text token
                if isinstance(item, dict) and item.get("type") == "done":
                    last_content   = item["content"]
                    final_sources  = item["sources"]
                    break          # no more items after the done sentinel

                # Regular streaming token
                last_content = item
                event = json.dumps({"token": item}, ensure_ascii=False)
                yield f"data: {event}\n\n"

            # Persist the full assistant response (no images on assistant turns)
            _add_message(session_id, "assistant", last_content, None)

            done_event = json.dumps(
                {
                    "done": True,
                    "content": last_content,
                    "sources": final_sources,
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
