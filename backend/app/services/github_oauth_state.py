"""Single-process, bounded, one-use OAuth transaction storage.

Not suitable for multiple workers or multiple application instances. Values are lost on restart.
This module does not perform OAuth, set cookies, or persist access tokens.
"""

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass, field
from threading import Lock
from time import monotonic
from typing import Literal


def pkce_challenge(code_verifier: str) -> str:
    """Derive the RFC 7636 S256 challenge without exposing the verifier."""
    if not 43 <= len(code_verifier) <= 128 or not all(
        c.isascii() and (c.isalnum() or c in "-._~") for c in code_verifier
    ):
        raise ValueError("Invalid PKCE verifier")
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


@dataclass(frozen=True)
class OAuthTransaction:
    purpose: Literal["login", "link"]
    browser_binding: str = field(repr=False)
    code_verifier: str = field(repr=False)
    expires_at: float
    user_id: int | None = None
    frontend_callback_url: str | None = None


class OAuthStateStore:
    """Store cryptographically random states with bounded lifetime and capacity."""

    def __init__(self, *, ttl_seconds: int = 300, capacity: int = 10000):
        if ttl_seconds < 1 or capacity < 1:
            raise ValueError("OAuth state TTL and capacity must be positive")
        self._ttl = ttl_seconds
        self._capacity = capacity
        self._items: dict[str, OAuthTransaction] = {}
        self._lock = Lock()

    def create(
        self,
        purpose: Literal["login", "link"],
        browser_binding: str,
        user_id: int | None = None,
        frontend_callback_url: str | None = None,
    ) -> tuple[str, OAuthTransaction]:
        if purpose not in ("login", "link") or not browser_binding:
            raise ValueError("Invalid OAuth transaction")
        if (purpose == "link") != (user_id is not None) or (user_id is not None and user_id < 1):
            raise ValueError("Link transactions require a user ID")
        now = monotonic()
        with self._lock:
            self._items = {k: v for k, v in self._items.items() if v.expires_at > now}
            if len(self._items) >= self._capacity:
                raise RuntimeError("OAuth transaction capacity reached")
            state = secrets.token_urlsafe(32)
            transaction = OAuthTransaction(
                purpose=purpose,
                browser_binding=browser_binding,
                code_verifier=secrets.token_urlsafe(64),
                expires_at=now + self._ttl,
                user_id=user_id,
                frontend_callback_url=frontend_callback_url,
            )
            self._items[state] = transaction
            return state, transaction

    def consume(self, state: str, browser_binding: str) -> OAuthTransaction | None:
        """Consume a matching state atomically; wrong browser cannot consume it."""
        with self._lock:
            transaction = self._items.get(state)
            if transaction is None:
                return None
            if transaction.expires_at <= monotonic():
                del self._items[state]
                return None
            if not hmac.compare_digest(transaction.browser_binding, browser_binding):
                return None
            del self._items[state]
            return transaction


class OneTimeHandoffStore:
    """Bounded short-lived handoffs; callers must not log stored payloads."""

    def __init__(self, *, ttl_seconds: int = 120, capacity: int = 10000):
        if ttl_seconds < 1 or capacity < 1:
            raise ValueError("Handoff TTL and capacity must be positive")
        self._ttl = ttl_seconds
        self._capacity = capacity
        self._items: dict[str, tuple[float, str, object]] = {}
        self._lock = Lock()

    def create(self, browser_binding: str, payload: object) -> str:
        if not browser_binding:
            raise ValueError("Browser binding is required")
        now = monotonic()
        with self._lock:
            self._items = {k: v for k, v in self._items.items() if v[0] > now}
            if len(self._items) >= self._capacity:
                raise RuntimeError("Handoff capacity reached")
            code = secrets.token_urlsafe(32)
            self._items[code] = (now + self._ttl, browser_binding, payload)
            return code

    def consume(self, code: str, browser_binding: str) -> object | None:
        with self._lock:
            value = self._items.get(code)
            if value is None:
                return None
            if value[0] <= monotonic():
                del self._items[code]
                return None
            if not hmac.compare_digest(value[1], browser_binding):
                return None
            del self._items[code]
            return value[2]
