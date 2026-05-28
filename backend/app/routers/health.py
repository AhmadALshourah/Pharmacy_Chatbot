"""Health check endpoint."""

from fastapi import APIRouter

from app.database import get_stats

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    """Return service status and document counts."""
    docs, chunks = get_stats()
    return {
        "status": "ok",
        "docs": docs,
        "chunks": chunks,
    }
