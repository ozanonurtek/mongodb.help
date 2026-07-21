"""Share-this-chat: public read-only view + signed-in fork.

A share is an unguessable token tied to a source chatId. Anyone with the link
can READ the chat (no auth, no rate-limit cost — the token is the secret).
Signed-in visitors can FORK: they get a brand new chat owned by themselves with
the messages copied in, and continue under THEIR OWN rate limit.

Rate-limit safety (the whole point of forking vs. live sharing):
  - Forking is just a `create_chat` that happens to copy messages. It reuses
    `check_signedup_chat_limits` + `inc_signedup_daily_chats`, so a signed-in
    visitor burns one of THEIR daily chats per fork. Anon visitors cannot fork
    (they must sign in), which also removes any same-IP anon-bypass path: the
    anon `anon:<iphash>` bucket is never touched here.
  - The forked chat's `messageCount` reflects the copied messages, so the
    visitor's per-chat message limit applies going forward; if the source was
    already over the visitor's per-chat limit, they can read the fork but not
    extend it (standard 429 on the next message).

Revocation: owner can delete the share token; future view/fork then 404.
Already-forked copies are independent chats owned by their forkers and are NOT
touched by revocation.
"""
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException

from db import chats_coll, messages_coll, shared_chats_coll
from identity import current_user
from limits import (
    SIGNEDUP_DAILY_CHATS,
    SIGNEDUP_MESSAGES_PER_CHAT,
    check_signedup_chat_limits,
    inc_signedup_daily_chats,
)

router = APIRouter(tags=["share"])


async def _resolve_owned_chat(chat_id: str, user: dict) -> dict:
    """Return the chat only if it exists and belongs to the caller. Anon
    callers own chats keyed by `anon:<iphash>`; signed-in by their user id."""
    chat = await chats_coll().find_one({"_id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat.get("userId") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return chat


def _require_user(user: dict) -> None:
    """Share link management is a signed-in-only feature. Anon users get 401
    so the UI can route them to sign-up; the public view/copy endpoints stay
    open (token-gated). This also removes the only anon write path on shares,
    so there is no anon-keyed share record to clean up on sign-in claim."""
    if user.get("kind") != "user":
        raise HTTPException(status_code=401, detail="Sign in to manage share links")


# --- owner endpoints (signed-in only) ---
@router.post("/api/chats/{chat_id}/share")
async def create_share(chat_id: str, user: dict = Depends(current_user)):
    """Create or return the active share token for this chat. Idempotent while
    the share lives; a fresh token is minted after revoke+recreate."""
    _require_user(user)
    await _resolve_owned_chat(chat_id, user)

    existing = await shared_chats_coll().find_one({"chatId": chat_id})
    if existing:
        return {
            "shareId": existing["_id"],
            "token": existing["token"],
            "createdAt": existing["createdAt"],
        }

    share_id = str(uuid.uuid4())
    token = str(uuid.uuid4())
    now = time.time()
    await shared_chats_coll().insert_one(
        {
            "_id": share_id,
            "token": token,
            "chatId": chat_id,
            "ownerId": user["id"],
            "createdAt": now,
        }
    )
    return {"shareId": share_id, "token": token, "createdAt": now}


@router.get("/api/chats/{chat_id}/share")
async def get_share(chat_id: str, user: dict = Depends(current_user)):
    """Owner-facing status: is there an active share for this chat, and what is
    its token? Returns 404 with `inactive` detail when no live share exists so
    the UI can distinguish 'never shared' from 'not your chat'."""
    _require_user(user)
    await _resolve_owned_chat(chat_id, user)
    existing = await shared_chats_coll().find_one({"chatId": chat_id})
    if not existing:
        raise HTTPException(status_code=404, detail="inactive")
    return {
        "shareId": existing["_id"],
        "token": existing["token"],
        "createdAt": existing["createdAt"],
    }


@router.delete("/api/chats/{chat_id}/share")
async def revoke_share(chat_id: str, user: dict = Depends(current_user)):
    """Revoke the share link. The token stops working immediately for view and
    fork. Copies already made are independent chats and are untouched."""
    _require_user(user)
    await _resolve_owned_chat(chat_id, user)
    res = await shared_chats_coll().delete_many({"chatId": chat_id})
    return {"ok": True, "revoked": res.deleted_count}


# --- public endpoints ---
async def _load_share_or_404(token: str) -> dict:
    share = await shared_chats_coll().find_one({"token": token})
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    chat = await chats_coll().find_one({"_id": share["chatId"]})
    if not chat:
        # Source chat was deleted (account deletion, admin purge, ...). The
        # share is now dead even though the token record still exists.
        raise HTTPException(status_code=404, detail="Share not found")
    return share


@router.get("/api/shared/{token}")
async def view_shared_chat(token: str):
    """Public, read-only view of the shared chat. No auth, no rate limit — the
    unguessable token IS the gate. Returns the title (if any) and messages in
    order. Feedback queryIds are stripped so a viewer cannot rate someone
    else's historical answer. Increments a best-effort view counter on the
    share record (used by the leads dashboard; never blocks the read)."""
    share = await _load_share_or_404(token)
    chat = await chats_coll().find_one({"_id": share["chatId"]})

    # Fire-and-forget view counter. Wrapped so a write failure (rare) cannot
    # break a read; the dashboard treats missing/0 views gracefully.
    try:
        await shared_chats_coll().update_one(
            {"_id": share["_id"]},
            {"$inc": {"views": 1}},
        )
    except Exception:
        pass

    cur = messages_coll().find({"chatId": share["chatId"]}).sort("createdAt", 1)
    msgs = []
    async for m in cur:
        msgs.append(
            {
                "role": m["role"],
                "content": m["content"],
                # Citations are useful context for the viewer; queryId is not
                # (feedback belongs to the original owner's query).
                "citations": m.get("citations"),
            }
        )
    return {
        "token": token,
        "chatId": share["chatId"],
        "title": chat.get("title"),
        "messageCount": chat.get("messageCount", len(msgs)),
        "messages": msgs,
        "createdAt": chat.get("createdAt"),
    }


@router.post("/api/shared/{token}/fork")
async def fork_shared_chat(token: str, user: dict = Depends(current_user)):
    """Copy the shared chat into a new chat owned by the signed-in caller, then
    return its id. Anon callers get 401 (no same-IP bypass path exists: anon
    fork is simply not offered). The caller's daily-chat quota is consumed via
    the SAME path as `create_chat`, so all existing limit semantics apply."""
    if user["kind"] != "user":
        raise HTTPException(status_code=401, detail="Sign in to fork this chat")

    share = await _load_share_or_404(token)
    source_chat_id = share["chatId"]
    source = await chats_coll().find_one({"_id": source_chat_id})
    if not source:  # double-check after _load_share_or_404 (race-free enough)
        raise HTTPException(status_code=404, detail="Share not found")

    user_id = user["id"]
    # Reuse the signed-up limit path: this is the rate-limiting seam. The check
    # is non-atomic with the inc (matches create_chat's existing tradeoff).
    await check_signedup_chat_limits(user_id, None)
    await inc_signedup_daily_chats(user_id)

    new_chat_id = str(uuid.uuid4())
    now = time.time()

    cur = messages_coll().find({"chatId": source_chat_id}).sort("createdAt", 1)
    docs = []
    async for m in cur:
        docs.append(
            {
                "_id": str(uuid.uuid4()),
                "chatId": new_chat_id,
                "role": m["role"],
                "content": m["content"],
                "citations": m.get("citations"),
                # Intentionally no queryId: these are historical copies, the
                # visitor's feedback on them is not actionable.
                "createdAt": now + (len(docs) * 0.001),
                "forkedFromQueryId": m.get("queryId"),
            }
        )

    await chats_coll().insert_one(
        {
            "_id": new_chat_id,
            "chatId": new_chat_id,
            "userId": user_id,
            "userKind": "user",
            "createdAt": now,
            "messageCount": len(docs),
            "title": source.get("title"),
            # ksConversationId is deliberately NOT copied: the fork must not
            # continue the source's Knowledge Service conversation (would leak
            # the owner's prior context into the visitor's thread and could
            # pollute the original if KS ever keyed bidirectionally).
            "forkedFromShare": token,
        }
    )
    if docs:
        await messages_coll().insert_many(docs)

    return {
        "chatId": new_chat_id,
        "messageCount": len(docs),
        "dailyChatsLimit": SIGNEDUP_DAILY_CHATS,
        "messagesPerChatLimit": SIGNEDUP_MESSAGES_PER_CHAT,
    }
