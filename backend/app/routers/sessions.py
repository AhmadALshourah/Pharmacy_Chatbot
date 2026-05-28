"""Chat session management endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.database import (
    get_chat_sessions,
    get_chat_session,
    get_chat_messages,
    delete_chat_session,
)
from app.dependencies import get_current_admin
from app.schemas.chat import ChatSessionResponse, ChatMessageRecord

log = logging.getLogger("pharmacy")

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=list[ChatSessionResponse])
async def list_sessions(admin: dict = Depends(get_current_admin)):
    """Return all chat sessions for the current admin, newest first."""
    return get_chat_sessions(admin["id"])


@router.get("/{session_id}/messages", response_model=list[ChatMessageRecord])
async def get_messages(session_id: int, admin: dict = Depends(get_current_admin)):
    """Return all messages in a session (must belong to the current admin)."""
    session = get_chat_session(session_id)
    if session is None or session["admin_id"] != admin["id"]:
        raise HTTPException(status_code=404, detail="Session not found.")
    return get_chat_messages(session_id)


@router.delete("/{session_id}", status_code=204)
async def remove_session(session_id: int, admin: dict = Depends(get_current_admin)):
    """Delete a session and all its messages (must belong to the current admin)."""
    session = get_chat_session(session_id)
    if session is None or session["admin_id"] != admin["id"]:
        raise HTTPException(status_code=404, detail="Session not found.")
    delete_chat_session(session_id)
    log.info(f"Admin {admin['id']} deleted session {session_id}")
