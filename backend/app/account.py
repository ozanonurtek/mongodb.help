"""User account self-service: data export and deletion.

Deletion is a SOFT delete: every document that belongs to the user is copied
into the matching `<name>_to_be_terminated` collection (with a `terminatedAt`
stamp) and then removed from the live collection. Nothing is hard-deleted on
the request path — a separate purge job (out of scope here) reaps the
terminated collections later.

Identity, as everywhere else in this codebase, comes ONLY from the gateway's
`X-Auth-User-Id` header — never from the request body — and is trusted only
when `X-Gateway-Sig` verifies (see `identity.py`).
"""
import time
import uuid
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from db import (
    USER_COLLECTIONS,
    accounts_coll,
    chats_coll,
    get_db,
    ledger_coll,
    messages_coll,
    queries_coll,
    shared_chats_coll,
    tickets_coll,
    users_coll,
    wallets_coll,
)
from identity import current_user

router = APIRouter(prefix="/api/account", tags=["account"])


def _require_user(user: dict) -> str:
    if user.get("kind") != "user":
        raise HTTPException(status_code=401, detail="Sign in to manage your account")
    return user["id"]


def _user_id_match(user_id: str):
    """Match `userId` whether it is stored as a string (our own collections:
    chats, queries, wallets, tickets, ...) or as an ObjectId (NextAuth's
    MongoDB adapter writes `accounts.userId` as ObjectId)."""
    if ObjectId.is_valid(user_id):
        return {"$in": [user_id, ObjectId(user_id)]}
    return user_id


def _serialize(doc: Any) -> Any:
    """Make a Mongo doc JSON-safe for export (ObjectId/datetime -> str)."""
    if isinstance(doc, list):
        return [_serialize(d) for d in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId):
                out[k] = str(v)
            elif hasattr(v, "isoformat"):
                out[k] = v.isoformat()
            elif isinstance(v, (bytes,)):
                out[k] = v.decode("utf-8", errors="replace")
            else:
                out[k] = _serialize(v)
        return out
    return doc


async def _gather_user_data(user_id: str) -> dict[str, list]:
    """Read every doc that belongs to the user across all user-scoped
    collections. chat_messages are joined via chatId (they have no userId)."""
    if ObjectId.is_valid(user_id):
        user = await users_coll().find_one({"_id": ObjectId(user_id)})
    else:
        user = None
    accounts = await accounts_coll().find({"userId": _user_id_match(user_id)}).to_list(None)
    wallet = await wallets_coll().find_one({"userId": user_id})
    ledger = await ledger_coll().find({"userId": user_id}).to_list(None)
    queries = await queries_coll().find({"userId": user_id}).to_list(None)
    chats = await chats_coll().find({"userId": user_id}).to_list(None)
    chat_ids = [c["_id"] for c in chats]
    messages = (
        await messages_coll().find({"chatId": {"$in": chat_ids}}).to_list(None)
        if chat_ids
        else []
    )
    tickets = await tickets_coll().find({"userId": user_id}).to_list(None)
    orders = await get_db()["orders"].find({"userId": user_id}).to_list(None)
    return {
        "users": [user] if user else [],
        "accounts": accounts,
        "wallets": [wallet] if wallet else [],
        "credit_transactions": ledger,
        "queries": queries,
        "chats": chats,
        "chat_messages": messages,
        "tickets": tickets,
        "orders": orders,
    }


@router.get("/export")
async def export_account(user: dict = Depends(current_user)):
    """Return the user's full data as JSON. The frontend triggers a download."""
    user_id = _require_user(user)
    data = await _gather_user_data(user_id)
    return {
        "exportedAt": time.time(),
        "userId": user_id,
        "collections": {k: _serialize(v) for k, v in data.items()},
    }


async def _move_to_terminated(user_id: str) -> dict[str, int]:
    """Copy every user-scoped doc into its `<name>_to_be_terminated` mirror
    and then delete the originals. Returns per-collection moved counts.

    Non-atomic across collections (Mongo standalone has no transactions); the
    ordering is intentional: identity-bearing collections (users, accounts) are
    moved LAST so that a mid-flight crash leaves a recoverable state where the
    user still exists but their content has already been archived.
    """
    data = await _gather_user_data(user_id)
    stamp = time.time()
    moved: dict[str, int] = {}

    # Content first, identity last.
    ordered = [c for c in USER_COLLECTIONS if c not in ("users", "accounts")]
    ordered += ["accounts", "users"]

    for name in ordered:
        docs = data.get(name, [])
        if not docs:
            moved[name] = 0
            continue
        payload = []
        for d in docs:
            d["_terminatedId"] = str(uuid.uuid4())
            d["_terminatedAt"] = stamp
            d["_terminatedUserId"] = user_id
            payload.append(d)
        target = get_db()[f"{name}_to_be_terminated"]
        await target.insert_many(payload)
        moved[name] = len(payload)

    # Deletes (also content-first, identity-last).
    chat_ids = [c["_id"] for c in data["chats"]]
    if chat_ids:
        await messages_coll().delete_many({"chatId": {"$in": chat_ids}})
        # Shares point at these chatIds; with the source gone they would 404
        # on view/fork anyway. Delete the records so the dashboard's share
        # count and per-user "shares created" stay honest post-deletion.
        await shared_chats_coll().delete_many({"chatId": {"$in": chat_ids}})
    await queries_coll().delete_many({"userId": user_id})
    await chats_coll().delete_many({"userId": user_id})
    await tickets_coll().delete_many({"userId": user_id})
    await ledger_coll().delete_many({"userId": user_id})
    await wallets_coll().delete_many({"userId": user_id})
    await get_db()["orders"].delete_many({"userId": user_id})
    await accounts_coll().delete_many({"userId": _user_id_match(user_id)})
    if ObjectId.is_valid(user_id):
        await users_coll().delete_one({"_id": ObjectId(user_id)})

    return moved


@router.delete("")
async def delete_account(user: dict = Depends(current_user)):
    """Soft-delete the account: archive everything to `*_to_be_terminated`
    collections and remove from the live collections. The caller's session/JWT
    is unaffected (that's the frontend's job — signing out post-delete)."""
    user_id = _require_user(user)
    moved = await _move_to_terminated(user_id)
    return {"ok": True, "userId": user_id, "moved": moved}
