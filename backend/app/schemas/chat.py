"""Schemas for chat and session endpoints."""

from typing import Literal
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single message in the conversation history."""
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    """Request body for POST /api/chat."""
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list)
    session_id: int | None = Field(
        default=None,
        description="Existing session to append to. Omit to create a new session.",
    )


class ChatSessionResponse(BaseModel):
    """A chat session record."""
    id: int
    admin_id: int
    title: str
    created_at: str
    updated_at: str


class ChatMessageRecord(BaseModel):
    """A persisted chat message."""
    id: int
    session_id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: str
