from concurrent.futures import ThreadPoolExecutor

import pytest

from app.services.github_oauth_state import OAuthStateStore, pkce_challenge


def test_pkce_rfc7636_s256_example():
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    assert pkce_challenge(verifier) == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"


@pytest.mark.parametrize("verifier", ["short", "é" * 43, "a" * 129, "a" * 42 + " "])
def test_pkce_invalid_verifier(verifier):
    with pytest.raises(ValueError):
        pkce_challenge(verifier)


def test_one_use_bound_to_browser():
    store = OAuthStateStore()
    state, transaction = store.create("login", "browser-one")
    assert store.consume(state, "browser-two") is None
    assert store.consume(state, "browser-one") == transaction
    assert store.consume(state, "browser-one") is None
    assert transaction.code_verifier not in repr(transaction)


def test_expiry_and_capacity(monkeypatch):
    now = [100.0]
    monkeypatch.setattr("app.services.github_oauth_state.monotonic", lambda: now[0])
    store = OAuthStateStore(ttl_seconds=10, capacity=1)
    state, _ = store.create("login", "browser")
    with pytest.raises(RuntimeError):
        store.create("login", "browser")
    now[0] += 10
    assert store.consume(state, "browser") is None
    store.create("login", "browser")


def test_link_must_be_bound_to_user():
    store = OAuthStateStore()
    with pytest.raises(ValueError):
        store.create("link", "browser")
    with pytest.raises(ValueError):
        store.create("login", "browser", user_id=1)
    state, _ = store.create("link", "browser", user_id=2)
    assert store.consume(state, "browser").user_id == 2


def test_concurrent_consumption_only_one_succeeds():
    store = OAuthStateStore()
    state, _ = store.create("login", "browser")
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: store.consume(state, "browser"), range(20)))
    assert sum(result is not None for result in results) == 1
