"""Chat rate-limit constants + helpers, shared by `main` (chat endpoints) and
`share` (fork). Kept in its own module so neither has to import the other.

Two identity-scoped buckets, both stored in `rate_limits` keyed by `(key, day)`:
  - anon:   `anon:<iphash>`     -> ANON_DAILY_CHATS new chats/day +
                                   ANON_MESSAGES_PER_CHAT msgs/chat
  - signed: `user:<id>`         -> SIGNEDUP_DAILY_CHATS / SIGNEDUP_MESSAGES_PER_CHAT

The check is non-atomic with the inc (two operations). This matches the v1
tradeoff in `create_chat`: a tightly concurrent pair of requests from the same
identity can both pass the check. Acceptable for free-tier limits; revisited
when paid tiers ship.
"""
import os
import time
from typing import Optional

from fastapi import HTTPException

from db import chats_coll, rate_limits_coll

# Limits / config
DAILY_FREE_GRANT = int(os.getenv("DAILY_FREE_GRANT", "5"))
ANON_DAILY_CHATS = int(os.getenv("ANON_DAILY_CHATS", "1"))
ANON_MESSAGES_PER_CHAT = int(os.getenv("ANON_MESSAGES_PER_CHAT", "5"))
SIGNEDUP_DAILY_CHATS = int(os.getenv("SIGNEDUP_DAILY_CHATS", "10"))
SIGNEDUP_MESSAGES_PER_CHAT = int(os.getenv("SIGNEDUP_MESSAGES_PER_CHAT", "50"))


def today() -> str:
    return time.strftime("%Y-%m-%d")


async def check_anon_chat_limits(key: str, chat_id: Optional[str]):
    rec = await rate_limits_coll().find_one({"key": key, "day": today()})
    chats_today = rec["chats"] if rec else 0
    if chat_id is None:
        if chats_today >= ANON_DAILY_CHATS:
            raise HTTPException(status_code=429, detail="Anonymous daily chat limit reached")
    else:
        chat = await chats_coll().find_one({"_id": chat_id})
        if chat and chat.get("messageCount", 0) >= ANON_MESSAGES_PER_CHAT:
            raise HTTPException(
                status_code=429, detail="Anonymous per-chat message limit reached"
            )


async def inc_anon_daily_chats(key: str):
    t = today()
    await rate_limits_coll().update_one(
        {"key": key, "day": t},
        {
            "$setOnInsert": {"key": key, "day": t, "expiresAt": time.time() + 24.1 * 3600},
            "$inc": {"chats": 1},
        },
        upsert=True,
    )


async def check_signedup_chat_limits(user_id: str, chat_id: Optional[str]):
    if chat_id is None:
        rec = await rate_limits_coll().find_one({"key": f"user:{user_id}", "day": today()})
        chats_today = rec["chats"] if rec else 0
        if chats_today >= SIGNEDUP_DAILY_CHATS:
            raise HTTPException(status_code=429, detail="Daily chat limit reached")
    else:
        chat = await chats_coll().find_one({"_id": chat_id})
        if chat and chat.get("messageCount", 0) >= SIGNEDUP_MESSAGES_PER_CHAT:
            raise HTTPException(
                status_code=429, detail="Per-chat message limit reached"
            )


async def inc_signedup_daily_chats(user_id: str):
    t = today()
    key = f"user:{user_id}"
    await rate_limits_coll().update_one(
        {"key": key, "day": t},
        {
            "$setOnInsert": {"key": key, "day": t, "expiresAt": time.time() + 24.1 * 3600},
            "$inc": {"chats": 1},
        },
        upsert=True,
    )
