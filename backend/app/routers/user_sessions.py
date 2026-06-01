"""User chat session management endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import (
    get_user_sessions,
    get_user_session,
    get_user_messages,
    delete_user_session,
    get_support_messages,
    add_support_message,
)
from app.dependencies import get_current_user
from app.schemas.chat import ChatMessageRecord
from app.schemas.user import UserSessionResponse

log = logging.getLogger("pharmacy")


class UserSupportReply(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

router = APIRouter(prefix="/user/sessions", tags=["user-sessions"])


# H8: sync def — FastAPI runs these in a threadpool automatically.

def list_user_sessions(user: dict = Depends(get_current_user)):
    """Return all chat sessions for the current user, newest first."""
    return get_user_sessions(user["id"])


def get_user_session_messages(
    session_id: int,
    user: dict = Depends(get_current_user),
):
    """Return all messages in a session (must belong to the current user)."""
    session = get_user_session(session_id)
    if session is None or session["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Session not found.")
    return get_user_messages(session_id)


def remove_user_session(
    session_id: int,
    user: dict = Depends(get_current_user),
):
    """Delete a session and all its messages (must belong to the current user)."""
    session = get_user_session(session_id)
    if session is None or session["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Session not found.")
    delete_user_session(session_id)
    log.info(f"User {user['id']} deleted session {session_id}")


def get_user_session_support(
    session_id: int,
    user: dict = Depends(get_current_user),
):
    """Return the support thread for one of the user's own sessions."""
    session = get_user_session(session_id)
    if session is None or session["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Session not found.")
    return get_support_messages(session_id)


def post_user_session_support(
    session_id: int,
    body: UserSupportReply,
    user: dict = Depends(get_current_user),
):
    """User replies to an admin support message in their session."""
    session = get_user_session(session_id)
    if session is None or session["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Session not found.")
    msg = add_support_message(
        session_id, "user", user["id"], user["username"], body.content.strip(),
    )
    log.info(f"User '{user['username']}' replied in support thread for session {session_id}")
    return msg


router.get("", response_model=list[UserSessionResponse])(list_user_sessions)
router.get("/{session_id}/messages", response_model=list[ChatMessageRecord])(get_user_session_messages)
router.delete("/{session_id}", status_code=204)(remove_user_session)
router.get("/{session_id}/support")(get_user_session_support)
router.post("/{session_id}/support", status_code=201)(post_user_session_support)
