"""User chat session management endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.database import (
    get_user_sessions,
    get_user_session,
    get_user_messages,
    delete_user_session,
)
from app.dependencies import get_current_user
from app.schemas.chat import ChatMessageRecord
from app.schemas.user import UserSessionResponse

log = logging.getLogger("pharmacy")

router = APIRouter(prefix="/user/sessions", tags=["user-sessions"])


@router.get("", response_model=list[UserSessionResponse])
async def list_user_sessions(user: dict = Depends(get_current_user)):
    """Return all chat sessions for the current user, newest first."""
    return get_user_sessions(user["id"])


@router.get("/{session_id}/messages", response_model=list[ChatMessageRecord])
async def get_user_session_messages(
    session_id: int,
    user: dict = Depends(get_current_user),
):
    """Return all messages in a session (must belong to the current user)."""
    session = get_user_session(session_id)
    if session is None or session["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Session not found.")
    return get_user_messages(session_id)


@router.delete("/{session_id}", status_code=204)
async def remove_user_session(
    session_id: int,
    user: dict = Depends(get_current_user),
):
    """Delete a session and all its messages (must belong to the current user)."""
    session = get_user_session(session_id)
    if session is None or session["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Session not found.")
    delete_user_session(session_id)
    log.info(f"User {user['id']} deleted session {session_id}")
