"""Schemas for the documents endpoints."""

from pydantic import BaseModel


class UploadResponse(BaseModel):
    """Response from the POST /api/documents/upload endpoint."""
    success: bool
    message: str
    doc_count: int
    chunk_count: int


class DocumentInfo(BaseModel):
    """A single document's metadata."""
    id: int
    filename: str
    page_count: int
    file_size: int
    created_at: str


class RebuildResponse(BaseModel):
    """Response from the POST /api/documents/rebuild endpoint."""
    success: bool
    doc_count: int
    chunk_count: int
