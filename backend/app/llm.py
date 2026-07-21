"""RAG pipeline over the MongoDB Knowledge Service (KS).

KS is the same RAG engine behind mongodb.com/docs. No API key required, only
an `origin` + `x-request-origin` header. Returns a grounded answer AND
citations, in the user's language, and is conversation-aware: the first message
goes to `conversations/null/messages` and the stream's `metadata` event returns
a `conversationId`; follow-ups go to `conversations/{id}/messages` so the
grounding keeps the chat's context.

This is the single answer path. (An optional OpenCode Zen refinement layer was
removed for v1, KS answers are grounded, cited, and multilingual on their own.)
"""
import json
import os
import re
from typing import Optional

import httpx
from fastapi import HTTPException

# --- Knowledge Service ---
KS_BASE = os.getenv("KS_BASE_URL", "https://knowledge.mongodb.com/api/v1")
KS_ORIGIN = os.getenv("KS_ORIGIN", "https://www.mongodb.com")
KS_REQUEST_ORIGIN = os.getenv("KS_REQUEST_ORIGIN", "https://www.mongodb.com/docs/")

TIMEOUT = httpx.Timeout(30.0, connect=10.0)

# Arabic 0600–06FF, Cyrillic 0400–04FF
# Hints are matched on whole words only, and words that are also common in
# English ("error", "base", "por") are excluded, otherwise English error
# pastes (which contain "error", "database", "import", ...) get misdetected.
_HINTS = {
    "tr": ["nasıl", "neden", "hatası", "nedir", "için", "yardım", "sorunu", "sorgu", "hata"],
    "de": ["wie", "warum", "fehler", "nicht", "funktioniert", "abfrage", "problem", "für"],
    "fr": ["comment", "pourquoi", "erreur", "requête", "problème", "données"],
    "es": ["cómo", "consulta", "problema", "datos", "lento", "ayuda", "gracias"],
}


def _detect(text: str) -> tuple[str, int]:
    """Returns (language, confidence). Confidence 0 means 'en' is just the
    default fallback, not a real detection."""
    for ch in text:
        if "؀" <= ch <= "ۿ":
            return "ar", 99
    for ch in text:
        if "Ѐ" <= ch <= "ӿ":
            return "ru", 99
    words = set(re.findall(r"[\wÀ-ÿ]+", text.lower()))
    best, best_score = "en", 0
    for lang, hints in _HINTS.items():
        score = len(words.intersection(hints))
        if score > best_score:
            best, best_score = lang, score
    return best, best_score


def detect_language(text: str) -> str:
    """Cheap offline language guess: script first, then keyword overlap."""
    return _detect(text)[0]


async def classify(text: str) -> dict:
    """Offline classifier: type by keyword, language by script/keywords.
    KS does its own retrieval, so we don't need an LLM here."""
    lower = text.lower()
    error_terms = ["error", "exception", "timeout", "fail", "errno", "panic", "traceback"]
    if any(k in lower for k in error_terms):
        qtype = "error"
    elif any(k in lower for k in [
        "slow", "performance", "latency", "profiler",
        "collscan", "executionstats", "winningplan",
    ]):
        # Deliberately excludes generic words like "explain"/"index", those
        # appear in conceptual questions ("explain the $lookup stage") that
        # are not slow-query diagnostics.
        qtype = "slow_query"
    else:
        qtype = "question"
    return {"type": qtype, "language": detect_language(text), "keyTerms": []}


def _ks_messages_url(conversation_id: Optional[str]) -> str:
    return f"{KS_BASE}/conversations/{conversation_id or 'null'}/messages"


def _ks_headers() -> dict:
    return {
        "accept": "text/event-stream",
        "content-type": "application/json",
        "origin": KS_ORIGIN,
        "x-request-origin": KS_REQUEST_ORIGIN,
        "user-agent": "mongodb.help/0.2",
    }


async def ground_stream(
    text: str, classification: dict, conversation_id: Optional[str] = None
):
    """Stream the Knowledge Service. Yields ('delta', str), ('citations',
    list), and ('conversation', id) when KS reports the conversation id."""
    citations: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream(
                "POST",
                _ks_messages_url(conversation_id),
                params={"stream": "true"},
                json={"message": text},
                headers=_ks_headers(),
            ) as r:
                if r.status_code >= 400:
                    body = (await r.aread()).decode("utf-8", "ignore")
                    raise HTTPException(
                        status_code=502,
                        detail=f"Knowledge Service HTTP {r.status_code}: {body[:200]}",
                    )
                async for line in r.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload:
                        continue
                    try:
                        ev = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    etype = ev.get("type")
                    if etype == "delta":
                        yield ("delta", ev.get("data", ""))
                    elif etype == "references":
                        for ref in ev.get("data", []) or []:
                            url = ref.get("url")
                            if url:
                                citations.append({"title": ref.get("title") or url, "url": url})
                        yield ("citations", list(citations))
                    elif etype == "metadata":
                        cid = (ev.get("data") or {}).get("conversationId")
                        if cid:
                            yield ("conversation", cid)
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Knowledge Service unavailable: {exc}")


def _title_fallback(text: str) -> str:
    first = text.strip().splitlines()[0].strip() if text.strip() else "New chat"
    return first[:60] if first else "New chat"


async def generate_title(text: str) -> str:
    """Short chat title from the first user message. KS has no title endpoint,
    so we use the truncated first line."""
    return _title_fallback(text)
