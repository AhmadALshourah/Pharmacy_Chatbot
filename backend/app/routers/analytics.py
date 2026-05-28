"""Analytics endpoint."""

from fastapi import APIRouter, Query

from app.database import get_analytics_rich, get_stats
from app.schemas.analytics import AnalyticsSummary

router = APIRouter(tags=["analytics"])

_PERIOD_DAYS = {"7d": 7, "30d": 30, "90d": 90}


@router.get("/analytics", response_model=AnalyticsSummary)
def analytics(period: str = Query("30d", pattern="^(7d|30d|90d)$")):  # H8: sync
    """Return aggregated query analytics for the requested period."""
    days = _PERIOD_DAYS.get(period, 30)
    summary = get_analytics_rich(days)
    docs, chunks = get_stats()
    return AnalyticsSummary(
        total=summary["total"],
        cached=summary["cached"],
        emergency=summary["emergency"],
        avg_ms=summary["avg_ms"],
        doc_count=docs,
        chunk_count=chunks,
        daily_counts=summary["daily_counts"],
        doc_stats=summary["doc_stats"],
        lang_en_pct=summary["lang_en_pct"],
        lang_ar_pct=summary["lang_ar_pct"],
        avg_sources=summary["avg_sources"],
    )
