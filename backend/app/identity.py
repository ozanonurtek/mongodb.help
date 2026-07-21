"""Request identity: resolve signed-in users vs anonymous callers.

Shared by `main.py` (chat endpoints) and `account.py` (self-service) so neither
has to import the other.

Identity is NEVER taken from the request body. A user id is trusted only when
the request comes from the trusted frontend gateway, which proves its identity
by HMAC-signing ``(method, path, user_id, ts)`` with ``GATEWAY_HMAC_SECRET``
and sending the signature in ``X-Gateway-Sig``. Without the secret, an attacker
who reaches the backend directly cannot forge a valid signature for an
arbitrary user id; the worst they can do is be treated as anonymous (rate-
limited, no access to user data). Everyone without a valid signature is
anonymous-by-IP.

Admin endpoints use a separate mechanism (``X-Admin-Token``, verified in
``admin.py``) and are not affected by this module.

Replay protection: the timestamp must be within ``GATEWAY_TS_TOLERANCE``
seconds (±120s) of the backend's clock. A captured signature is therefore
usable only on the same method+path within that window; it cannot be used
to forge a different user id, since the user id is part of the signed
message. Body and query string are NOT signed (FastAPI reads the body once
per request); if you need stronger replay protection, add a nonce cache.
"""
import hashlib
import hmac
import os
import time
from typing import Optional

from fastapi import Header, Request

# Shared with the frontend gateway (frontend/src/app/api/[...slug]/route.ts).
# If unset, the backend refuses to trust any user-id header — signed-in
# features degrade to anonymous. Set this in production.
GATEWAY_HMAC_SECRET = os.getenv("GATEWAY_HMAC_SECRET")
GATEWAY_TS_TOLERANCE = 120  # seconds, symmetric window around server clock


def _hash_ip(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def client_ip(request: Request) -> str:
    """Best-effort real client IP for anonymous identity.

    Production proxy chain:
        client -> Cloudflare -> Docker Swarm ingress -> nginx -> frontend -> backend

    The Swarm ingress mesh rewrites the source address to an internal VIP, so
    ``$remote_addr`` (and the LAST ``X-Forwarded-For`` hop) is the same private
    IP for every visitor, taking it collapses all anonymous users into one
    identity (shared rate-limit bucket + shared chat list).

    Preferred sources, in order:
      1. ``CF-Connecting-IP``, set by Cloudflare, tamper-proof (CF overwrites
         any client-supplied value).
      2. The LEFTMOST ``X-Forwarded-For`` entry, the original client IP as
         recorded by the first trusted proxy. Client-spoofable if no CDN sits
         in front, but far better than the shared mesh address.
      3. ``request.client.host``, direct connection (local dev / no proxy).
    """
    cf = request.headers.get("cf-connecting-ip")
    if cf and cf.strip():
        return _hash_ip(cf.strip())

    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        first = fwd.split(",")[0].strip()
        if first:
            return _hash_ip(first)

    if request.client and request.client.host:
        return _hash_ip(request.client.host)

    return _hash_ip("unknown")


def anon_key(request: Request) -> str:
    return f"anon:{client_ip(request)}"


def _verify_gateway_sig(
    method: str,
    path: str,
    user_id: str,
    ts_str: str,
    sig_hex: str,
) -> bool:
    """Verify the gateway's HMAC-SHA256 signature for a user-id assertion.

    Returns True iff: the secret is configured, the timestamp parses, it is
    within ``GATEWAY_TS_TOLERANCE`` of now, and the signature matches
    (constant-time comparison). Any failure returns False — callers then
    treat the request as anonymous.
    """
    if not GATEWAY_HMAC_SECRET:
        return False
    try:
        ts = int(ts_str)
    except (TypeError, ValueError):
        return False
    now = int(time.time())
    if abs(now - ts) > GATEWAY_TS_TOLERANCE:
        return False
    # Message format MUST match the gateway:
    #   [method, path, user_id, str(ts)].join("\n")
    message = "\n".join([method, path, user_id, str(ts)]).encode()
    expected = hmac.new(
        GATEWAY_HMAC_SECRET.encode(), message, hashlib.sha256
    ).hexdigest()
    # compare_digest is constant-time on equal-length strings; we pass two
    # hex strings of the same expected length (64 chars for SHA-256).
    return hmac.compare_digest(expected, sig_hex)


def current_user(
    request: Request,
    x_auth_user_id: Optional[str] = Header(None, alias="X-Auth-User-Id"),
    x_gateway_sig: Optional[str] = Header(None, alias="X-Gateway-Sig"),
    x_gateway_ts: Optional[str] = Header(None, alias="X-Gateway-Ts"),
) -> dict:
    """Resolve the caller. A user id is trusted only when accompanied by a
    valid gateway signature; everyone else is anonymous-by-IP.

    A request that carries ``X-Auth-User-Id`` WITHOUT a valid signature is
    treated as anonymous rather than rejected, so legitimate clients are not
    broken by a misconfigured gateway secret (fail-safe downgrade, not
    fail-open).
    """
    if x_auth_user_id and x_gateway_sig and x_gateway_ts:
        if _verify_gateway_sig(
            request.method,
            request.url.path,
            x_auth_user_id,
            x_gateway_ts,
            x_gateway_sig,
        ):
            return {"kind": "user", "id": x_auth_user_id}
    return {"kind": "anon", "id": anon_key(request)}
