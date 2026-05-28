"""Schemas for the analytics endpoint."""

from pydantic import BaseModel


class DocStat(BaseModel):
    name: str
    citations: int
    pct: float


class AnalyticsSummary(BaseModel):
    """Aggregated query analytics."""
    total: int
    cached: int
    emergency: int
    avg_ms: int | None
    doc_count: int
    chunk_count: int
    daily_counts: list[int] = []
    doc_stats: list[DocStat] = []
    lang_en_pct: int = 0
    lang_ar_pct: int = 0
    avg_sources: float = 0.0
