"""Sliding window rate limiter — keyed per principal so one user cannot block others."""

import time
import logging
from collections import deque, defaultdict

from app.config import RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW

log = logging.getLogger("pharmacy")


class RateLimiter:
    """Per-principal sliding window rate limiter.

    Each unique ``key`` (e.g. ``"admin_1"`` or ``"user_3"``) maintains its
    own sliding window, so one abusive caller cannot consume the quota of
    others.  Stale entries are expired lazily on every check() call.
    """

    def __init__(
        self,
        max_requests: int = RATE_LIMIT_REQUESTS,
        window_seconds: int = RATE_LIMIT_WINDOW,
    ):
        self._windows: dict[str, deque] = defaultdict(deque)
        self._max_requests = max_requests
        self._window = window_seconds

    def check(self, key: str = "global") -> bool:
        """Return True if the request is allowed, False if rate-limited."""
        now = time.time()
        times = self._windows[key]

        # Evict timestamps outside the current window
        while times and now - times[0] > self._window:
            times.popleft()

        if len(times) >= self._max_requests:
            log.warning(f"Rate limit exceeded for {key!r}")
            return False

        times.append(now)
        return True
