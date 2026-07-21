"""Admin API for the leads.mongodb.help dashboard.

Auth model: a single shared password (ADMIN_PASSWORD) that the dashboard
exchanges for a short-lived JWT signed with ADMIN_SECRET. The dashboard's
gateway forwards that JWT as `X-Admin-Token`; `require_admin` verifies it with
stdlib HMAC-SHA256 (no PyJWT dependency, the token is a standard JWS, so this
interoperates with the dashboard's `jose` signer).

This is deliberately separate from the OAuth-based user auth (X-Auth-User-Id):
admins are trusted operators, not users in the `users` collection.
"""
import base64
import datetime
import hashlib
import hmac
import json
import os
import time
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from db import (
    users_coll,
    accounts_coll,
    queries_coll,
    tickets_coll,
    chats_coll,
    shared_chats_coll,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_STATUSES = ("open", "in_progress", "resolved", "closed")
ANON_PREFIX = "anon:"


# --- token verification (stdlib HS256 JWS) ---
def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verify_admin_token(token: str, secret: str) -> bool:
    try:
        h, p, sig = token.split(".")
    except ValueError:
        return False
    try:
        given = _b64url_decode(sig)
    except Exception:
        return False
    expected = hmac.new(
        secret.encode(), f"{h}.{p}".encode(), hashlib.sha256
    ).digest()
    if not hmac.compare_digest(expected, given):
        return False
    try:
        payload = json.loads(_b64url_decode(p))
    except Exception:
        return False
    if payload.get("sub") != "admin":
        return False
    exp = payload.get("exp")
    if isinstance(exp, (int, float)) and time.time() > exp:
        return False
    return True


def require_admin(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
) -> bool:
    secret = os.getenv("ADMIN_SECRET", "")
    if not secret or not x_admin_token or not verify_admin_token(x_admin_token, secret):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    return True


def _is_anon(user_id: str) -> bool:
    return bool(user_id) and user_id.startswith(ANON_PREFIX)


def _ts_to_date(ts: float) -> datetime.datetime:
    return datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc)


async def _emails_for(user_ids: list[str]) -> dict[str, Optional[str]]:
    """Batch-resolve {userId(string) -> email} for non-anon ids."""
    oids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
    out: dict[str, Optional[str]] = {}
    if not oids:
        return out
    async for u in users_coll().find({"_id": {"$in": oids}}, {"email": 1}):
        out[str(u["_id"])] = u.get("email")
    return out


# --- stats ---
@router.get("/stats", dependencies=[Depends(require_admin)])
async def stats():
    now = time.time()
    total_users = await users_coll().count_documents({})
    users_24h = await users_coll().count_documents(
        {"createdAt": {"$gte": _ts_to_date(now - 86400)}}
    )
    users_7d = await users_coll().count_documents(
        {"createdAt": {"$gte": _ts_to_date(now - 7 * 86400)}}
    )

    total_q = await queries_coll().count_documents({})
    anon_q = await queries_coll().count_documents(
        {"userId": {"$regex": f"^{ANON_PREFIX}"}}
    )
    up = await queries_coll().count_documents({"feedback": "up"})
    down = await queries_coll().count_documents({"feedback": "down"})

    tickets_by_status = {}
    for s in VALID_STATUSES:
        tickets_by_status[s] = await tickets_coll().count_documents({"status": s})

    # --- share / fork funnel ---
    # Shares: how many chat links exist (and recent activity). Forks: how many
    # signed-in visitors turned a shared chat into their own copy — the key
    # lead-gen conversion signal for this feature. Views is a soft top-of-
    # funnel counter incremented best-effort on each read of a share.
    total_shares = await shared_chats_coll().count_documents({})
    shares_24h = await shared_chats_coll().count_documents(
        {"createdAt": {"$gte": now - 86400}}
    )
    shares_7d = await shared_chats_coll().count_documents(
        {"createdAt": {"$gte": now - 7 * 86400}}
    )
    total_forks = await chats_coll().count_documents(
        {"forkedFromShare": {"$exists": True}}
    )
    forks_24h = await chats_coll().count_documents(
        {
            "forkedFromShare": {"$exists": True},
            "createdAt": {"$gte": now - 86400},
        }
    )
    views_total = 0
    async for v in shared_chats_coll().aggregate(
        [{"$group": {"_id": None, "n": {"$sum": {"$ifNull": ["$views", 0]}}}}]
    ):
        views_total = v.get("n", 0)

    return {
        "users": {"total": total_users, "last24h": users_24h, "last7d": users_7d},
        "questions": {
            "total": total_q,
            "anonymous": anon_q,
            "signedIn": total_q - anon_q,
            "up": up,
            "down": down,
        },
        "tickets": tickets_by_status,
        "shares": {
            "total": total_shares,
            "last24h": shares_24h,
            "last7d": shares_7d,
            "totalViews": views_total,
            "forks": {"total": total_forks, "last24h": forks_24h},
        },
    }


# --- leads (signed-up users with engagement) ---
@router.get("/leads", dependencies=[Depends(require_admin)])
async def list_leads():
    users = await users_coll().find(
        {}, {"email": 1, "name": 1, "image": 1, "createdAt": 1}
    ).to_list(None)

    accounts = await accounts_coll().find({}, {"userId": 1, "provider": 1}).to_list(None)
    provider_by_user: dict[str, list[str]] = {}
    for a in accounts:
        uid = str(a.get("userId"))
        if a.get("provider"):
            provider_by_user.setdefault(uid, []).append(a["provider"])

    qstats: dict[str, dict] = {}
    async for r in queries_coll().aggregate(
        [
            {
                "$group": {
                    "_id": "$userId",
                    "q": {"$sum": 1},
                    "neg": {
                        "$sum": {"$cond": [{"$eq": ["$feedback", "down"]}, 1, 0]}
                    },
                    "last": {"$max": "$createdAt"},
                }
            }
        ]
    ):
        qstats[r["_id"]] = {"q": r["q"], "neg": r["neg"], "last": r["last"]}

    tstats: dict[str, int] = {}
    async for r in tickets_coll().aggregate(
        [{"$group": {"_id": "$userId", "t": {"$sum": 1}}}]
    ):
        tstats[r["_id"]] = r["t"]

    leads = []
    for u in users:
        uid = str(u["_id"])
        qs = qstats.get(uid, {})
        leads.append(
            {
                "id": uid,
                "email": u.get("email"),
                "name": u.get("name"),
                "image": u.get("image"),
                "providers": sorted(set(provider_by_user.get(uid, []))),
                "createdAt": u.get("createdAt"),
                "lastActive": qs.get("last"),
                "questionCount": qs.get("q", 0),
                "ticketCount": tstats.get(uid, 0),
                "negativeFeedbackCount": qs.get("neg", 0),
            }
        )
    leads.sort(
        key=lambda x: (x["questionCount"] + x["ticketCount"], x["negativeFeedbackCount"]),
        reverse=True,
    )
    return {"leads": leads, "total": len(leads)}


@router.get("/leads/{user_id}", dependencies=[Depends(require_admin)])
async def lead_detail(user_id: str):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    user = await users_coll().find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Lead not found")
    providers = [
        a.get("provider")
        async for a in accounts_coll().find({"userId": user_id}, {"provider": 1})
        if a.get("provider")
    ]
    qs = (
        await queries_coll()
        .find(
            {"userId": user_id},
            {
                "inputRedacted": 1,
                "classifiedType": 1,
                "language": 1,
                "feedback": 1,
                "feedbackNote": 1,
                "createdAt": 1,
            },
        )
        .sort("createdAt", -1)
        .to_list(100)
    )
    ts = (
        await tickets_coll()
        .find(
            {"userId": user_id},
            {"subject": 1, "status": 1, "createdAt": 1, "updatedAt": 1},
        )
        .sort("createdAt", -1)
        .to_list(100)
    )
    for d in qs:
        d["id"] = str(d.pop("_id"))
    for d in ts:
        d["id"] = str(d.pop("_id"))

    # Share engagement for THIS lead: shares they created + total forks of
    # those shares. Surfaces "this person's content gets shared & copied" — a
    # high-quality lead signal that question count alone misses.
    user_shares = await shared_chats_coll().count_documents({"ownerId": user_id})
    user_share_tokens = [
        s["token"]
        async for s in shared_chats_coll().find({"ownerId": user_id}, {"token": 1})
    ]
    forks_of_user_shares = (
        await chats_coll().count_documents(
            {"forkedFromShare": {"$in": user_share_tokens}}
        )
        if user_share_tokens
        else 0
    )

    return {
        "id": user_id,
        "email": user.get("email"),
        "name": user.get("name"),
        "image": user.get("image"),
        "providers": sorted(set(providers)),
        "createdAt": user.get("createdAt"),
        "questions": qs,
        "tickets": ts,
        "shares": {
            "created": user_shares,
            "totalForks": forks_of_user_shares,
        },
    }


# --- shares / forks ---
@router.get("/shares", dependencies=[Depends(require_admin)])
async def list_shares():
    """Every active share link with its owner, source chat title, view count,
    and fork count. Sorted by forks desc then views desc — surfaces the chats
    that actually convert viewers into signed-in users.

    Fork counts come from `chats.forkedFromShare == token` (the source of
    truth), aggregated in one pass; views come from the share doc's denormalized
    counter (incremented best-effort on each read)."""
    shares = await shared_chats_coll().find({}).sort("createdAt", -1).to_list(None)

    # Aggregate fork counts per token in a single pass over chats.
    forks_by_token: dict[str, int] = {}
    async for r in chats_coll().aggregate(
        [
            {"$match": {"forkedFromShare": {"$exists": True}}},
            {"$group": {"_id": "$forkedFromShare", "n": {"$sum": 1}}},
        ]
    ):
        forks_by_token[r["_id"]] = r["n"]

    # Resolve owner email + source-chat title in batch.
    owner_ids = sorted({s.get("ownerId") for s in shares if s.get("ownerId")})
    owner_emails = await _emails_for(owner_ids)
    source_ids = [s["chatId"] for s in shares if s.get("chatId")]
    titles_by_chat: dict[str, str | None] = {}
    if source_ids:
        async for c in chats_coll().find({"_id": {"$in": source_ids}}, {"title": 1}):
            titles_by_chat[c["_id"]] = c.get("title")

    out = []
    for s in shares:
        token = s.get("token")
        chat_id = s.get("chatId")
        out.append(
            {
                "shareId": s.get("_id"),
                "token": token,
                "chatId": chat_id,
                "title": titles_by_chat.get(chat_id),
                "ownerId": s.get("ownerId"),
                "ownerEmail": owner_emails.get(s.get("ownerId")),
                "views": s.get("views", 0),
                "forks": forks_by_token.get(token, 0),
                "createdAt": s.get("createdAt"),
            }
        )
    out.sort(key=lambda x: (x["forks"], x["views"]), reverse=True)
    return {"shares": out, "total": len(out)}


# --- questions ---
@router.get("/questions", dependencies=[Depends(require_admin)])
async def list_questions(
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    total = await queries_coll().count_documents({})
    docs = (
        await queries_coll()
        .find(
            {},
            {
                "inputRedacted": 1,
                "classifiedType": 1,
                "language": 1,
                "feedback": 1,
                "feedbackNote": 1,
                "createdAt": 1,
                "userId": 1,
            },
        )
        .sort("createdAt", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    emails = await _emails_for([d["userId"] for d in docs if not _is_anon(d.get("userId", ""))])
    for d in docs:
        uid = d.get("userId", "")
        d["email"] = emails.get(uid) if not _is_anon(uid) else None
        d["isAnon"] = _is_anon(uid)
        d["id"] = str(d.pop("_id"))
    return {"questions": docs, "total": total, "limit": limit, "skip": skip}


# --- tickets ---
@router.get("/tickets", dependencies=[Depends(require_admin)])
async def list_all_tickets():
    docs = await tickets_coll().find({}).sort("createdAt", -1).to_list(None)
    emails = await _emails_for(
        [str(d.get("userId")) for d in docs if not _is_anon(str(d.get("userId", "")))]
    )
    for d in docs:
        uid = str(d.get("userId", ""))
        d["email"] = emails.get(uid)
        d["id"] = str(d.pop("_id"))
    return {"tickets": docs, "total": len(docs)}


@router.get("/tickets/{ticket_id}", dependencies=[Depends(require_admin)])
async def ticket_detail(ticket_id: str):
    t = await tickets_coll().find_one({"_id": ticket_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    uid = str(t.get("userId", ""))
    emails = await _emails_for([uid] if not _is_anon(uid) else [])
    t["email"] = emails.get(uid)
    t["id"] = str(t.pop("_id"))
    return t


class TicketStatusUpdate(BaseModel):
    status: str


class TicketMessageCreate(BaseModel):
    body: str


@router.patch("/tickets/{ticket_id}", dependencies=[Depends(require_admin)])
async def update_ticket_status(ticket_id: str, req: TicketStatusUpdate):
    if req.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {', '.join(VALID_STATUSES)}",
        )
    res = await tickets_coll().find_one_and_update(
        {"_id": ticket_id},
        {"$set": {"status": req.status, "updatedAt": time.time()}},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"ok": True, "id": ticket_id, "status": req.status}


@router.post("/tickets/{ticket_id}/messages", dependencies=[Depends(require_admin)])
async def post_ticket_message(ticket_id: str, req: TicketMessageCreate):
    """Lead/admin appends a reply to the ticket conversation. Does not change
    status, leads set that explicitly via PATCH (e.g. open -> in_progress)."""
    body = req.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message body is required")
    now = time.time()
    res = await tickets_coll().find_one_and_update(
        {"_id": ticket_id},
        {
            "$push": {"messages": {"author": "admin", "body": body, "createdAt": now}},
            "$set": {"updatedAt": now},
        },
    )
    if not res:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {
        "ok": True,
        "message": {"author": "admin", "body": body, "createdAt": now},
    }
