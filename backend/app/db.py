"""MongoDB connection, indexes, and seed data.

The app connects as the Mongo root user (project decision: no separate app user).
"""
import os
import time

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://root:rootpass@localhost:27017/mongodbhelp?authSource=admin",
)
DB_NAME = os.getenv("MONGODB_DB", "mongodbhelp")

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    global _db
    if _db is None:
        _db = get_client()[DB_NAME]
    return _db


# --- collection accessors ---
def users_coll():
    return get_db()["users"]


def accounts_coll():
    return get_db()["accounts"]


def wallets_coll():
    return get_db()["wallets"]


def ledger_coll():
    return get_db()["credit_transactions"]


def model_pricing_coll():
    return get_db()["model_pricing"]


def orders_coll():
    return get_db()["orders"]


def queries_coll():
    return get_db()["queries"]


def chats_coll():
    return get_db()["chats"]


def messages_coll():
    return get_db()["chat_messages"]


def rate_limits_coll():
    return get_db()["rate_limits"]


def tickets_coll():
    return get_db()["tickets"]


def shared_chats_coll():
    # Share tokens: map an unguessable token -> a source chatId so anyone with
    # the link can read the chat read-only, and signed-in visitors can fork it
    # into their own copy. Kept out of USER_COLLECTIONS so account deletion
    # does not wipe share links the user may want to keep (forks are already
    # independent chats; the share record only points at the source).
    return get_db()["shared_chats"]


# --- to_be_terminated mirrors ---
# Soft-delete targets: when a user requests account deletion, every doc that
# belongs to them is moved (copy + delete) into the matching `*_to_be_terminated`
# collection so data can be purged/recovered off the hot path. Global or
# TTL-expiring collections (model_pricing, rate_limits) have no mirror.
TERMINATED_SUFFIX = "_to_be_terminated"

USER_COLLECTIONS = (
    "users",
    "accounts",
    "wallets",
    "credit_transactions",
    "queries",
    "chats",
    "chat_messages",
    "tickets",
    "orders",
)


def terminated_coll(name: str):
    if name not in USER_COLLECTIONS:
        raise ValueError(f"unknown user collection: {name}")
    return get_db()[f"{name}{TERMINATED_SUFFIX}"]


async def ping() -> None:
    await get_client().admin.command("ping")


async def init_db(pricing_seed: dict) -> None:
    """Create indexes and seed reference data. Idempotent; safe on every startup."""
    db = get_db()

    await db.rate_limits.create_index([("key", 1), ("day", 1)], unique=True)
    await db.rate_limits.create_index("expiresAt", expireAfterSeconds=0)
    await db.chats.create_index([("userId", 1), ("createdAt", -1)])
    # Sparse: only chats that are forks of a share carry `forkedFromShare`.
    # Lets the dashboard count forks without scanning the whole collection.
    await db.chats.create_index("forkedFromShare", sparse=True)
    await db.chat_messages.create_index([("chatId", 1), ("createdAt", 1)])
    await db.chat_messages.create_index("queryId")
    await db.queries.create_index([("userId", 1), ("createdAt", -1)])
    await db.queries.create_index("chatId")
    await db.users.create_index("email", unique=True)
    await db.wallets.create_index("userId", unique=True)
    await db.accounts.create_index("userId")
    await db.accounts.create_index(
        [("provider", 1), ("providerAccountId", 1)], unique=True
    )
    await db.tickets.create_index([("userId", 1), ("createdAt", -1)])
    await db.tickets.create_index("status")
    await db.model_pricing.create_index("modelId", unique=True)
    # Shared-chat tokens: token is the public lookup key (unique), chatId
    # supports the owner's "get/revoke my share" lookup.
    await db.shared_chats.create_index("token", unique=True)
    await db.shared_chats.create_index("chatId")

    # Seed standard-tier models so credit deduction has a cost to read.
    now = time.time()
    for model_id, spec in pricing_seed.items():
        await db.model_pricing.update_one(
            {"modelId": model_id},
            {
                "$setOnInsert": {
                    "modelId": model_id,
                    "tier": spec["tier"],
                    "creditCost": spec["creditCost"],
                    "createdAt": now,
                }
            },
            upsert=True,
        )
