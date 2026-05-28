"""Sliding window rate limiter."""

import time
import logging
from collections import deque

from app.config import RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW

log = logging.getLogger("pharmacy")


class RateLimiter:
    """Sliding window rate limiter to prevent API abuse."""

    def __init__(
        self,
        max_requests: int = RATE_LIMIT_REQUESTS,
        window_seconds: int = RATE_LIMIT_WINDOW,
    ):
        self._request_times: deque = deque()
        self._max_requests = max_requests
        self._window = window_seconds

    def check(self) -> bool:
        """Return True if request is allowed, False if rate limited."""
        now = time.time()
        while self._request_times and now - self._request_times[0] > self._window:
            self._request_times.popleft()
        if len(self._request_times) >= self._max_requests:
            log.warning("Rate limit exceeded")
            return False
        self._request_times.append(now)
        return True
