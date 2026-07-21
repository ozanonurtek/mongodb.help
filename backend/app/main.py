import os
import re
import json
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import ReturnDocument

from db import (
    init_db,
    ping,
    wallets_coll,
    ledger_coll,
    model_pricing_coll,
    queries_coll,
    chats_coll,
    messages_coll,
    rate_limits_coll,
    shared_chats_coll,
    tickets_coll,
)
from llm import classify, ground_stream, generate_title
from admin import router as admin_router
from account import router as account_router
from share import router as share_router, _resolve_owned_chat
from identity import current_user, anon_key
from limits import (
    DAILY_FREE_GRANT,
    ANON_DAILY_CHATS,
    ANON_MESSAGES_PER_CHAT,
    SIGNEDUP_DAILY_CHATS,
    SIGNEDUP_MESSAGES_PER_CHAT,
    today,
    check_anon_chat_limits,
    inc_anon_daily_chats,
    check_signedup_chat_limits,
    inc_signedup_daily_chats,
)

MODEL_PRICING = {
    "deepseek-v4-flash-free": {"tier": "standard", "creditCost": 1},
    "mimo-v2.5-free": {"tier": "standard", "creditCost": 1},
}
STANDARD_MODEL = "deepseek-v4-flash-free"

# Commit this image was built from (baked into the image by CI, see Dockerfile
# + build.yml). Empty in local dev. Surfaced on /api/health for "what's
# deployed?" debugging without shell access.
GIT_COMMIT_SHA = os.getenv("GIT_COMMIT_SHA", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await ping()
    except Exception as exc:
        raise RuntimeError(f"Cannot reach MongoDB: {exc}") from exc
    await init_db(MODEL_PRICING)
    yield


app = FastAPI(title="mongodb.help API", version="0.2.0", lifespan=lifespan)
app.include_router(admin_router)
app.include_router(account_router)
app.include_router(share_router)

ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:3333,http://localhost,http://localhost:8888"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_RE = [
    re.compile(r"(mongodb(?:\+srv)?://)([^:@/]+):([^@/]+)@", re.I),
    re.compile(r"(api[_-]?key\s*=\s*)[^\s&]+", re.I),
    re.compile(r"(password\s*=\s*)[^\s&]+", re.I),
    re.compile(r"(AKIA[0-9A-Z]{16})"),
]


def redact(text: str) -> str:
    out = text
    out = SECRET_RE[0].sub(r"\1\2:****@", out)
    out = SECRET_RE[1].sub(r"\1****", out)
    out = SECRET_RE[2].sub(r"\1****", out)
    out = SECRET_RE[3].sub("****", out)
    return out


# --- wallets / credits ---
async def ensure_wallet(user_id: str) -> dict:
    today_str = today()
    w = await wallets_coll().find_one({"userId": user_id})
    if w is None:
        await wallets_coll().insert_one(
            {
                "userId": user_id,
                "purchasedBalance": 0,
                "freeResetDay": today_str,
                "freeBalance": DAILY_FREE_GRANT,
                "createdAt": time.time(),
            }
        )
        w = await wallets_coll().find_one({"userId": user_id})
    if w["freeResetDay"] != today_str:
        await wallets_coll().update_one(
            {"userId": user_id},
            {"$set": {"freeResetDay": today_str, "freeBalance": DAILY_FREE_GRANT}},
        )
        w["freeResetDay"] = today_str
        w["freeBalance"] = DAILY_FREE_GRANT
    return w


async def consume_credit(user_id: str, model_id: str) -> int:
    """Atomic debit: try free balance first, then purchased. Appends a ledger row."""
    pricing = await model_pricing_coll().find_one({"modelId": model_id})
    cost = pricing["creditCost"] if pricing else 1

    updated = await wallets_coll().find_one_and_update(
        {"userId": user_id, "freeBalance": {"$gte": cost}},
        {"$inc": {"freeBalance": -cost}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        updated = await wallets_coll().find_one_and_update(
            {"userId": user_id, "purchasedBalance": {"$gte": cost}},
            {"$inc": {"purchasedBalance": -cost}},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            raise HTTPException(status_code=402, detail="Insufficient credits")

    balance_after = updated["freeBalance"] + updated["purchasedBalance"]
    await ledger_coll().insert_one(
        {
            "_id": str(uuid.uuid4()),
            "userId": user_id,
            "type": "consume",
            "amount": -cost,
            "source": f"query:{uuid.uuid4()}",
            "modelId": model_id,
            "balanceAfter": balance_after,
            "createdAt": time.time(),
        }
    )
    return cost


# --- request models ---
# Identity is NEVER taken from the request body, only from the gateway's
# X-Auth-User-Id header — and that header is trusted only when X-Gateway-Sig
# verifies (see identity.py). A body userId would let any caller impersonate
# any user, which is why it's absent here.
class CreateChatRequest(BaseModel):
    pass


class MessageRequest(BaseModel):
    chatId: str
    content: str


class FeedbackRequest(BaseModel):
    queryId: str
    rating: int
    note: Optional[str] = None


class TicketRequest(BaseModel):
    subject: str
    body: str
    relatedQueryId: Optional[str] = None


class TicketMessageRequest(BaseModel):
    body: str


@app.get("/api/health")
async def health():
    return {"status": "ok", "commitSha": GIT_COMMIT_SHA or None}


@app.get("/api/config")
def get_config():
    return {
        "anonDailyChats": ANON_DAILY_CHATS,
        "anonMessagesPerChat": ANON_MESSAGES_PER_CHAT,
        "signedupDailyChats": SIGNEDUP_DAILY_CHATS,
        "signedupMessagesPerChat": SIGNEDUP_MESSAGES_PER_CHAT,
        "dailyFreeGrant": DAILY_FREE_GRANT,
    }


@app.post("/api/chats")
async def create_chat(req: CreateChatRequest, user: dict = Depends(current_user)):
    if user["kind"] == "anon":
        await check_anon_chat_limits(user["id"], None)
        await inc_anon_daily_chats(user["id"])
    else:
        await check_signedup_chat_limits(user["id"], None)
        await inc_signedup_daily_chats(user["id"])

    chat_id = str(uuid.uuid4())
    now = time.time()
    await chats_coll().insert_one(
        {
            "_id": chat_id,
            "chatId": chat_id,
            "userId": user["id"],
            "userKind": user["kind"],
            "createdAt": now,
            "messageCount": 0,
        }
    )
    return {"chatId": chat_id}


@app.get("/api/chats")
async def list_chats(user: dict = Depends(current_user)):
    cur = (
        chats_coll()
        .find({"userId": user["id"]}, {"messageCount": 1, "createdAt": 1, "title": 1})
        .sort("createdAt", -1)
    )
    out = []
    async for c in cur:
        first = await messages_coll().find_one(
            {"chatId": c["_id"], "role": "user"}, sort=[("createdAt", 1)]
        )
        out.append(
            {
                "chatId": c["_id"],
                "messageCount": c.get("messageCount", 0),
                "createdAt": c.get("createdAt"),
                "title": c.get("title"),
                "preview": (first or {}).get("content", "")[:80],
            }
        )
    return {"chats": out}


@app.get("/api/chats/{chat_id}/messages")
async def list_chat_messages(chat_id: str, user: dict = Depends(current_user)):
    # Ownership check: anon callers and other users cannot read chats they
    # don't own. Share-link reads go through /api/shared/{token}, not here.
    # Return value unused — the call is for the 404/403 side effect.
    await _resolve_owned_chat(chat_id, user)
    cur = messages_coll().find({"chatId": chat_id}).sort("createdAt", 1)
    msgs = []
    async for m in cur:
        msgs.append(
            {
                "role": m["role"],
                "content": m["content"],
                "citations": m.get("citations"),
                "queryId": m.get("queryId"),
            }
        )
    return {"chatId": chat_id, "messages": msgs}


@app.post("/api/chats/claim")
async def claim_anon_chats(request: Request, user: dict = Depends(current_user)):
    """Adopt anonymous chats created from this browser/IP into the signed-in
    account. Re-keys `chats` and `queries` from `anon:<iphash>` to the user id;
    `chat_messages` follow their chatId automatically. Also re-keys
    `shared_chats.ownerId` so the user keeps managing share links they created
    while anon. Idempotent."""
    if user["kind"] != "user":
        return {"claimed": 0}
    anon_id = anon_key(request)
    user_id = user["id"]
    res = await chats_coll().update_many(
        {"userId": anon_id, "userKind": "anon"},
        {"$set": {"userId": user_id, "userKind": "user"}},
    )
    await queries_coll().update_many(
        {"userId": anon_id},
        {"$set": {"userId": user_id}},
    )
    # Re-key share ownership. chatId-keyed view/fork already worked across the
    # claim (they look up by chatId, not userId); this just keeps the owner
    # endpoints (_resolve_owned_chat checks chat.userId, so already correct)
    # and the dashboard's ownerEmail resolution accurate.
    if res.modified_count > 0:
        claimed_chat_ids = [c["_id"] async for c in chats_coll().find(
            {"userId": user_id}, {"_id": 1}
        )]
        if claimed_chat_ids:
            await shared_chats_coll().update_many(
                {"chatId": {"$in": claimed_chat_ids}},
                {"$set": {"ownerId": user_id}},
            )
    return {"claimed": res.modified_count}


@app.get("/api/usage")
async def get_usage(request: Request, user: dict = Depends(current_user)):
    """Current usage for the usage popup. Limits + counters are kind-specific:
    anon = IP-keyed daily chats + per-chat messages; signed-in = user-keyed."""
    if user["kind"] == "user":
        rec = await rate_limits_coll().find_one(
            {"key": f"user:{user['id']}", "day": today()}
        )
        chats_today = rec["chats"] if rec else 0
        return {
            "kind": "user",
            "dailyChatsUsed": chats_today,
            "dailyChatsLimit": SIGNEDUP_DAILY_CHATS,
            "messagesPerChatLimit": SIGNEDUP_MESSAGES_PER_CHAT,
        }
    rec = await rate_limits_coll().find_one(
        {"key": user["id"], "day": today()}
    )
    chats_today = rec["chats"] if rec else 0
    return {
        "kind": "anon",
        "dailyChatsUsed": chats_today,
        "dailyChatsLimit": ANON_DAILY_CHATS,
        "messagesPerChatLimit": ANON_MESSAGES_PER_CHAT,
    }


@app.post("/api/chats/message")
async def send_message(
    req: MessageRequest,
    user: dict = Depends(current_user),
):
    # Ownership check: a caller can only extend their own chat. Without this,
    # anyone who knows a chatId could post into another user's thread (and
    # burn that user's rate-limit quota).
    chat = await _resolve_owned_chat(req.chatId, user)

    # Signed-in callers are identified by the gateway header; anon callers reuse
    # the chat's stored IP-based key.
    if user["kind"] == "user":
        user_id = user["id"]
        await check_signedup_chat_limits(user_id, req.chatId)
    else:
        user_id = chat.get("userId", user["id"])
        await check_anon_chat_limits(user_id, req.chatId)

    redacted = redact(req.content)
    now = time.time()
    message_count_after = chat.get("messageCount", 0) + 1
    is_first = chat.get("messageCount", 0) == 0
    ks_conversation = chat.get("ksConversationId")

    await chats_coll().update_one({"_id": req.chatId}, {"$inc": {"messageCount": 1}})
    await messages_coll().insert_one(
        {
            "_id": str(uuid.uuid4()),
            "chatId": req.chatId,
            "role": "user",
            "content": redacted,
            "createdAt": now,
        }
    )

    query_id = str(uuid.uuid4())

    def sse(obj: dict) -> str:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

    async def event_stream():
        nonlocal ks_conversation
        t0 = time.time()
        collected: list[str] = []
        citations: list[dict] = []
        classification = {"type": "question", "language": "en", "keyTerms": []}
        try:
            classification = await classify(redacted)
            yield sse({
                "type": "start",
                "queryId": query_id,
                "messageCount": message_count_after,
                "classification": classification,
            })
            async for kind, val in ground_stream(
                redacted, classification, ks_conversation
            ):
                if kind == "citations":
                    citations = val
                    yield sse({"type": "citations", "citations": citations})
                elif kind == "conversation":
                    if val != ks_conversation:
                        ks_conversation = val
                        await chats_coll().update_one(
                            {"_id": req.chatId},
                            {"$set": {"ksConversationId": val}},
                        )
                elif kind == "delta":
                    collected.append(val)
                    yield sse({"type": "delta", "text": val})
        except HTTPException as exc:
            yield sse({"type": "error", "status": exc.status_code, "detail": exc.detail})
            return
        except Exception as exc:  # pragma: no cover - defensive
            yield sse({"type": "error", "status": 500, "detail": str(exc)})
            return

        answer = "".join(collected).strip()
        latency_ms = int((time.time() - t0) * 1000)

        await messages_coll().insert_one(
            {
                "_id": str(uuid.uuid4()),
                "chatId": req.chatId,
                "role": "assistant",
                "content": answer,
                "citations": citations,
                "queryId": query_id,
                "createdAt": time.time(),
            }
        )
        await queries_coll().insert_one(
            {
                "_id": query_id,
                "userId": user_id,
                "chatId": req.chatId,
                "inputRaw": req.content,
                "inputRedacted": redacted,
                "classifiedType": classification["type"],
                "language": classification["language"],
                "groundingCitations": citations,
                "answerMarkdown": answer,
                "feedback": None,
                "modelUsed": STANDARD_MODEL,
                "latencyMs": latency_ms,
                "createdAt": now,
            }
        )

        if is_first:
            try:
                title = await generate_title(redacted)
                if title:
                    await chats_coll().update_one({"_id": req.chatId}, {"$set": {"title": title}})
                    yield sse({"type": "title", "title": title})
            except Exception:
                pass

        yield sse({"type": "done", "messageCount": message_count_after})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/feedback")
async def feedback(req: FeedbackRequest, user: dict = Depends(current_user)):
    # Ownership check: only the original asker can rate an answer. Without
    # this, anyone who learns a queryId (e.g. from a shared chat) could
    # manipulate another user's feedback stats. Anon callers match on their
    # IP hash just like chat ownership.
    owned = await queries_coll().find_one(
        {"_id": req.queryId, "userId": user["id"]}, {"_id": 1}
    )
    if not owned:
        raise HTTPException(status_code=404, detail="Query not found")
    if req.rating > 0:
        value = "up"
    elif req.rating < 0:
        value = "down"
    else:
        value = None
    # Down-votes can carry an optional "what was missing?" note. Strip it for
    # up-votes/neutral so stale notes don't leak across rating changes.
    note = (req.note or "").strip() if value == "down" else ""
    update = {"$set": {"feedback": value}}
    if note:
        update["$set"]["feedbackNote"] = note
    elif value != "down":
        update["$unset"] = {"feedbackNote": ""}
    await queries_coll().update_one({"_id": req.queryId}, update)
    return {"ok": True, "queryId": req.queryId, "rating": req.rating}


def require_self(user_id: str, user: dict):
    """Path userId must match the authenticated caller, no reading other
    users' wallets or tickets."""
    if user["kind"] != "user" or user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")


@app.get("/api/credits/{user_id}")
async def get_credits(user_id: str, user: dict = Depends(current_user)):
    require_self(user_id, user)
    w = await ensure_wallet(user_id)
    return {"freeBalance": w["freeBalance"], "purchasedBalance": w["purchasedBalance"]}


@app.post("/api/credits/purchase")
def purchase():
    raise HTTPException(status_code=501, detail="coming soon")


@app.post("/api/tickets")
async def create_ticket(req: TicketRequest, user: dict = Depends(current_user)):
    if user["kind"] != "user":
        raise HTTPException(status_code=401, detail="Sign in to open a ticket")
    ticket_id = str(uuid.uuid4())
    now = time.time()
    await tickets_coll().insert_one(
        {
            "_id": ticket_id,
            "userId": user["id"],
            "subject": req.subject,
            "status": "open",
            "priority": "normal",
            "relatedQueryId": req.relatedQueryId,
            "messages": [{"author": "user", "body": req.body, "createdAt": now}],
            "createdAt": now,
            "updatedAt": now,
        }
    )
    return {"ok": True, "ticketId": ticket_id}


@app.get("/api/tickets/{user_id}")
async def list_tickets(user_id: str, user: dict = Depends(current_user)):
    require_self(user_id, user)
    cur = (
        tickets_coll()
        .find({"userId": user_id}, {"subject": 1, "status": 1, "createdAt": 1, "updatedAt": 1})
        .sort("createdAt", -1)
    )
    out = []
    async for t in cur:
        out.append(
            {
                "ticketId": t["_id"],
                "subject": t.get("subject"),
                "status": t.get("status"),
                "createdAt": t.get("createdAt"),
                "updatedAt": t.get("updatedAt"),
            }
        )
    return {"tickets": out}


@app.get("/api/ticket/{ticket_id}")
async def get_user_ticket(ticket_id: str, user: dict = Depends(current_user)):
    """Signed-in user fetches one of their own tickets with the full conversation.
    Ownership is enforced by the {userId: user["id"]} filter, no separate
    require_self check needed (the ticket_id is the resource identifier)."""
    if user["kind"] != "user":
        raise HTTPException(status_code=401, detail="Sign in to view tickets")
    t = await tickets_coll().find_one({"_id": ticket_id, "userId": user["id"]})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {
        "ticketId": t["_id"],
        "subject": t.get("subject"),
        "status": t.get("status"),
        "priority": t.get("priority"),
        "relatedQueryId": t.get("relatedQueryId"),
        "messages": t.get("messages", []),
        "createdAt": t.get("createdAt"),
        "updatedAt": t.get("updatedAt"),
    }


@app.post("/api/ticket/{ticket_id}/messages")
async def post_user_ticket_message(
    ticket_id: str,
    req: TicketMessageRequest,
    user: dict = Depends(current_user),
):
    """Signed-in user appends a reply to their own ticket. A user reply on a
    resolved/closed ticket reopens it (status -> open) so leads see activity."""
    if user["kind"] != "user":
        raise HTTPException(status_code=401, detail="Sign in to reply")
    body = req.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message body is required")
    now = time.time()
    res = await tickets_coll().find_one_and_update(
        {"_id": ticket_id, "userId": user["id"]},
        {
            "$push": {"messages": {"author": "user", "body": body, "createdAt": now}},
            "$set": {"status": "open", "updatedAt": now},
        },
        return_document=ReturnDocument.AFTER,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {
        "ok": True,
        "message": {"author": "user", "body": body, "createdAt": now},
        "status": "open",
    }
