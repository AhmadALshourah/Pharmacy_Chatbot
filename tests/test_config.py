"""Tests for config constants and helper logic."""

from config import (
    EMERGENCY_KEYWORDS, MAX_QUERY_LENGTH, RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW, CACHE_MAX_SIZE, RETRIEVAL_TOP_K,
    EMBEDDING_MODEL, CHAT_MODEL, SYSTEM_PROMPT,
)


def _is_emergency(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in EMERGENCY_KEYWORDS)


def _validate(query: str):
    query = query.strip()
    if not query:
        return False, "empty"
    if len(query) > MAX_QUERY_LENGTH:
        return False, "too long"
    return True, query


# ── Emergency detection ───────────────────────────────────────────────────────

class TestEmergencyDetection:
    def test_detects_overdose_english(self):
        assert _is_emergency("I think I overdosed on medication") is True

    def test_detects_suicide_english(self):
        assert _is_emergency("I want to kill myself") is True

    def test_detects_breathing_issue(self):
        assert _is_emergency("I can't breathe, throat is closing") is True

    def test_detects_poisoning(self):
        assert _is_emergency("I think I was poisoned") is True

    def test_detects_arabic_overdose(self):
        assert _is_emergency("أعاني من جرعة زائدة") is True

    def test_detects_arabic_breathing(self):
        assert _is_emergency("لا أستطيع التنفس") is True

    def test_ignores_normal_query_english(self):
        assert _is_emergency("What is Aspirin used for?") is False

    def test_ignores_normal_query_arabic(self):
        assert _is_emergency("ما هو الأسبرين؟") is False

    def test_ignores_side_effects_query(self):
        assert _is_emergency("What are the side effects of ibuprofen?") is False

    def test_case_insensitive(self):
        assert _is_emergency("OVERDOSE") is True
        assert _is_emergency("Heart Attack") is True


# ── Input validation ──────────────────────────────────────────────────────────

class TestValidation:
    def test_empty_string_rejected(self):
        ok, _ = _validate("")
        assert ok is False

    def test_whitespace_only_rejected(self):
        ok, _ = _validate("   ")
        assert ok is False

    def test_normal_query_accepted(self):
        ok, q = _validate("What is Aspirin?")
        assert ok is True
        assert q == "What is Aspirin?"

    def test_strips_whitespace(self):
        ok, q = _validate("  What is Aspirin?  ")
        assert ok is True
        assert q == "What is Aspirin?"

    def test_too_long_rejected(self):
        ok, _ = _validate("x" * (MAX_QUERY_LENGTH + 1))
        assert ok is False

    def test_max_length_accepted(self):
        ok, _ = _validate("x" * MAX_QUERY_LENGTH)
        assert ok is True


# ── Config sanity checks ──────────────────────────────────────────────────────

class TestConfigSanity:
    def test_emergency_keywords_not_empty(self):
        assert len(EMERGENCY_KEYWORDS) > 0

    def test_has_arabic_keywords(self):
        arabic = [kw for kw in EMERGENCY_KEYWORDS if any('؀' <= c <= 'ۿ' for c in kw)]
        assert len(arabic) > 0

    def test_reasonable_limits(self):
        assert MAX_QUERY_LENGTH >= 500
        assert RATE_LIMIT_REQUESTS > 0
        assert RATE_LIMIT_WINDOW > 0
        assert CACHE_MAX_SIZE > 0
        assert RETRIEVAL_TOP_K > 0

    def test_models_defined(self):
        assert EMBEDDING_MODEL
        assert CHAT_MODEL

    def test_system_prompt_not_empty(self):
        assert len(SYSTEM_PROMPT) > 100
