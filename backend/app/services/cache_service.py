"""LRU response cache for repeated queries."""

from collections import OrderedDict

from app.config import CACHE_MAX_SIZE


class CacheService:
    """Thread-safe LRU cache for chatbot responses."""

    def __init__(self, max_size: int = CACHE_MAX_SIZE):
        self._cache: OrderedDict = OrderedDict()
        self._max_size = max_size

    def get(self, key: str) -> str | None:
        """Retrieve a cached response. Returns None on miss."""
        normalized = key.lower().strip()
        if normalized in self._cache:
            self._cache.move_to_end(normalized)
            return self._cache[normalized]
        return None

    def set(self, key: str, value: str) -> None:
        """Store a response in the cache, evicting oldest if full."""
        normalized = key.lower().strip()
        self._cache[normalized] = value
        self._cache.move_to_end(normalized)
        if len(self._cache) > self._max_size:
            self._cache.popitem(last=False)

    def clear(self) -> None:
        """Clear all cached responses."""
        self._cache.clear()

    @property
    def size(self) -> int:
        return len(self._cache)
