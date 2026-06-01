"""Admin endpoints for monitoring user conversations and sending support messages."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import (
    get_all_user_sessions_for_admin,
    get_user_session,
    get_user_messages,
    get_support_messages,
    add_support_message,
)
from app.dependencies import get_current_admin

log = logging.getLogger("pharmacy")

router = APIRouter(prefix="/admin/conversations", tags=["admin-conversations"])


class SupportMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class UserSessionWithUser(BaseModel):
    id: int
    user_id: int
    username: str
    title: str
    created_at: str
    updated_at: str


class SupportMessageRecord(BaseModel):
    id: int
    session_id: int
    sender_type: str
    sender_id: int
    sender_name: str
    content: str
    created_at: str


# H8: sync def — FastAPI runs these in a threadpool automatically.

def list_conversations(admin: dict = Depends(get_current_admin)):
    """List all user chat sessions for admin review, newest first."""
    return get_all_user_sessions_for_admin()


def get_conversation_messages(session_id: int, admin: dict = Depends(get_current_admin)):
    """Return the AI conversation messages for any user session (read-only)."""
    session = get_user_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return get_user_messages(session_id)


def get_conversation_support(session_id: int, admin: dict = Depends(get_current_admin)):
    """Return the support thread for a user session."""
    session = get_user_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return get_support_messages(session_id)


def post_conversation_support(
    session_id: int,
    body: SupportMessageRequest,
    admin: dict = Depends(get_current_admin),
):
    """Admin sends a support message to the user in a specific session."""
    session = get_user_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    msg = add_support_message(
        session_id, "admin", admin["id"], admin["username"], body.content.strip(),
    )
    log.info(f"Admin '{admin['username']}' sent support message to session {session_id}")
    return msg


router.get("",
    response_model=list[UserSessionWithUser])(list_conversations)
router.get("/{session_id}/messages")(get_conversation_messages)
router.get("/{session_id}/support",
    response_model=list[SupportMessageRecord])(get_conversation_support)
router.post("/{session_id}/support",
    status_code=201,
    response_model=SupportMessageRecord)(post_conversation_support)
