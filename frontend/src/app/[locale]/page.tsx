"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChatSidebar, ChatSidebarTrigger } from "@/components/chat/chat-sidebar";
import { ChatThread } from "@/components/chat/chat-thread";
import { ChatComposer } from "@/components/chat/chat-composer";
import { CreditBanner } from "@/components/chat/credit-banner";
import { DisclaimerBanner } from "@/components/chat/disclaimer-banner";
import { SignupPromptDialog } from "@/components/chat/signup-prompt-dialog";
import { UsageDialog } from "@/components/chat/usage-dialog";
import { AccountDialog } from "@/components/chat/account-dialog";
import { ShareDialog } from "@/components/chat/share-dialog";
import { Share2 } from "lucide-react";

type Msg = {
  role: "user" | "assistant";
  content: string;
  citations?: { title: string; url: string }[];
  queryId?: string;
  rating?: number;
};

type Chat = { chatId: string; title?: string; preview?: string; messageCount?: number };

export default function ChatPage() {
  const t = useTranslations();
  const { data: session, status } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    kind: string;
    dailyChatsUsed: number;
    dailyChatsLimit: number;
    messagesPerChatLimit: number;
  } | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showShareSignup, setShowShareSignup] = useState(false);
  const claimedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isSignedIn = !!session?.user?.id;
  const activeChatObj = chats.find((c) => c.chatId === activeChat);
  const freeBalance = usage
    ? isSignedIn
      ? Math.max(0, usage.dailyChatsLimit - usage.dailyChatsUsed)
      : Math.max(0, usage.messagesPerChatLimit - (activeChatObj?.messageCount ?? 0))
    : null;
  const bannerTotal = usage
    ? isSignedIn
      ? usage.dailyChatsLimit
      : usage.messagesPerChatLimit
    : 0;

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats`);
      const data = await res.json();
      setChats(data.chats || []);
    } catch {}
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch(`/api/usage`);
      if (res.ok) setUsage(await res.json());
    } catch {}
  }, []);

  // Adopt anonymous chats into the signed-in account, then refresh.
  useEffect(() => {
    if (session?.user?.id && !claimedRef.current) {
      claimedRef.current = true;
      fetch(`/api/chats/claim`, { method: "POST" })
        .then(() => loadChats())
        .then(() => loadUsage())
        .catch(() => {});
    }
  }, [session, loadChats, loadUsage]);

  useEffect(() => {
    loadUsage();
    loadChats();
  }, [loadUsage, loadChats]);

  const STORAGE_KEY = "mh:activeChat";

  const selectChat = useCallback(async (id: string) => {
    setActiveChat(id);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${id}/messages`);
      // 404 = chat deleted; 403 = chat exists but caller doesn't own it
      // (e.g. after logout, mh:activeChat points to the previously
      // signed-in user's chat). Either way, drop it locally.
      if (res.status === 404 || res.status === 403) {
        setChats((cs) => cs.filter((c) => c.chatId !== id));
        setActiveChat(null);
        setMessages([]);
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        return;
      }
      if (!res.ok) {
        setMessages([]);
        return;
      }
      const data = await res.json();
      setMessages(
        (data.messages || []).map((m: Msg) => ({
          role: m.role,
          content: m.content,
          citations: m.citations ?? undefined,
          queryId: m.queryId ?? undefined,
        })),
      );
    } catch {
      setMessages([]);
    }
  }, []);

  // Persist the active chat so a reload reopens the same thread.
  // IMPORTANT: skip the very first run. activeChat's initial state is null,
  // so on a fresh mount this effect would run with activeChat=null and
  // removeItem() the saved id — racing against (and destroying) the restore
  // effect below, which also runs on mount. The ref gates the wipe until
  // we've had at least one render where we intentionally chose the active
  // chat (so a deliberate "clear" still removes the key).
  const persistMountedRef = useRef(false);
  useEffect(() => {
    if (!persistMountedRef.current) {
      persistMountedRef.current = true;
      return;
    }
    try {
      if (activeChat) localStorage.setItem(STORAGE_KEY, activeChat);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [activeChat]);

  // Restore the active chat on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) selectChat(saved);
    } catch {}
  }, [selectChat]);

  // Clear any local chat state when the session ends (logout, expiry, or
  // account deletion). Without this, mh:activeChat would survive logout and
  // the next (anonymous) caller on this browser would inherit the previous
  // user's chat UI — even though the backend now 403s the actual reads, the
  // UI should not pretend the chat is still open. We check `status` rather
  // than `session` so this does not fire during the initial "loading" phase
  // (which would wipe a saved chat before the session restores it).
  useEffect(() => {
    if (status !== "unauthenticated") return;
    setActiveChat(null);
    setMessages([]);
    setChats([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, [status]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  async function newChat() {
    setError(null);
    const res = await fetch(`/api/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 429) {
      if (!isSignedIn) setShowSignupPrompt(true);
      else setError(t("limit.signedChatLimit"));
      return;
    }
    if (!res.ok) {
      setError(t("networkError"));
      return;
    }
    const data = await res.json();
    setActiveChat(data.chatId);
    setMessages([]);
    setChats((c) => [{ chatId: data.chatId, messageCount: 0 }, ...c]);
    loadUsage();
  }

  async function send() {
    if (!input.trim() || loading) return;
    setError(null);
    const content = input.trim();
    const userMsg: Msg = { role: "user", content };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      let chatId: string | null = activeChat;
      if (!chatId) {
        const cRes = await fetch(`/api/chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (cRes.status === 429) {
          if (!isSignedIn) setShowSignupPrompt(true);
          else setError(t("limit.signedChatLimit"));
          setMessages((m) => m.slice(0, -1));
          return;
        }
        if (!cRes.ok) {
          setError(t("networkError"));
          setMessages((m) => m.slice(0, -1));
          return;
        }
        const newChatId: string = (await cRes.json()).chatId;
        chatId = newChatId;
        setActiveChat(newChatId);
        setChats((c) => [{ chatId: newChatId, messageCount: 0 }, ...c]);
        loadUsage();
      }
      const res = await fetch(`/api/chats/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, content }),
      });
      if (res.status === 429) {
        if (!isSignedIn) setShowSignupPrompt(true);
        else setError(t("limit.messageLimit"));
        setMessages((m) => m.slice(0, -1));
        return;
      }
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({}));
        setError(e.detail || t("networkError"));
        setMessages((m) => m.slice(0, -1));
        return;
      }

      // Stream the assistant reply as SSE.
      // Citations + queryId are buffered and attached only at `done`, so they
      // render AFTER the text (not before it). The assistant bubble is created on
      // the first delta; until then the "thinking" indicator stays visible.
      const appendDelta = (text: string) =>
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last && last.role === "assistant") {
            return [...m.slice(0, -1), { ...last, content: last.content + text }];
          }
          return [...m, { role: "assistant", content: text }];
        });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotAny = false;
      let streamQueryId: string | undefined;
      let streamCitations: Msg["citations"];

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) >= 0) {
          const raw = buffer.slice(0, sep).trim();
          buffer = buffer.slice(sep + 2);
          if (!raw.startsWith("data:")) continue;
          const payload = raw.slice(5).trim();
          if (!payload) continue;
          let ev: { type: string; [k: string]: unknown };
          try {
            ev = JSON.parse(payload);
          } catch {
            continue;
          }
          switch (ev.type) {
            case "start":
              streamQueryId = ev.queryId as string;
              setChats((cs) =>
                cs.map((c) =>
                  c.chatId === chatId
                    ? { ...c, messageCount: ev.messageCount as number }
                    : c,
                ),
              );
              break;
            case "citations":
              streamCitations = ev.citations as Msg["citations"];
              break;
            case "delta":
              gotAny = true;
              appendDelta(ev.text as string);
              break;
            case "title":
              setChats((cs) =>
                cs.map((c) => (c.chatId === chatId ? { ...c, title: ev.title as string } : c)),
              );
              break;
            case "done":
              // Reveal citations + feedback now that the text is complete.
              setMessages((m) => {
                const last = m[m.length - 1];
                if (last && last.role === "assistant") {
                  return [
                    ...m.slice(0, -1),
                    {
                      ...last,
                      citations: streamCitations ?? last.citations,
                      queryId: streamQueryId ?? last.queryId,
                    },
                  ];
                }
                return m;
              });
              break;
            case "error":
              setError((ev.detail as string) || t("networkError"));
              break;
          }
        }
      }
      if (gotAny) {
        /* message-count tracked client-side via chat SSE start event */
      } else setMessages((m) => {
        // nothing streamed back, drop a stray assistant placeholder if any
        const last = m[m.length - 1];
        return last && last.role === "assistant" && !last.content ? m.slice(0, -1) : m;
      });
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function rate(queryId: string, rating: number, note?: string) {
    setMessages((m) =>
      m.map((x) => (x.queryId === queryId ? { ...x, rating } : x))
    );
    await fetch(`/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queryId, rating, note: note ?? null }),
    }).catch(() => {});
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background text-foreground">
      <ChatSidebar
        chats={chats}
        activeChat={activeChat}
        onNewChat={newChat}
        onSelectChat={selectChat}
        newChatLabel={t("sidebar.newChat")}
        chatsLabel={t("sidebar.chats")}
        legal={{
          disclaimer: t("legal.disclaimer"),
          terms: t("legal.terms"),
          privacy: t("legal.privacy"),
        }}
        signedIn={isSignedIn}
        onShowUsage={() => (isSignedIn ? setShowAccount(true) : setShowUsage(true))}
        usageLabel={t("usage.open")}
        accountLabel={t("account.open")}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only bar: drawer trigger for the chat list (desktop uses the
            static sidebar; the shared site header lives in the layout). */}
        <div className="flex items-center border-b border-border bg-card px-2 py-1.5 md:hidden">
          <ChatSidebarTrigger
            label={t("sidebar.newChat")}
            chats={chats}
            activeChat={activeChat}
            onNewChat={newChat}
            onSelectChat={selectChat}
            newChatLabel={t("sidebar.newChat")}
            chatsLabel={t("sidebar.chats")}
            legal={{
              disclaimer: t("legal.disclaimer"),
              terms: t("legal.terms"),
              privacy: t("legal.privacy"),
            }}
            signedIn={isSignedIn}
            onShowUsage={() => (isSignedIn ? setShowAccount(true) : setShowUsage(true))}
            usageLabel={t("usage.open")}
            accountLabel={t("account.open")}
          />
        </div>

        <DisclaimerBanner
          text={t("disclaimerBanner.text")}
          linkLabel={t("disclaimerBanner.link")}
          linkHref="/legal/disclaimer"
        />

        <CreditBanner
          freeBalance={freeBalance}
          dailyGrant={bannerTotal}
          noneLabel={isSignedIn ? t("credits.none") : t("credits.anonNone")}
          lowLabel={(c) =>
            isSignedIn ? t("credits.low", { count: c }) : t("credits.anonLow", { count: c })
          }
          okLabel={(c) =>
            isSignedIn ? t("credits.ok", { count: c }) : t("credits.anonOk", { count: c })
          }
        />

        {/* Active-chat header: title + Share. Hidden until the chat has
            content (sharing an empty thread is pointless). The Share button
            is gated on sign-in at the click handler — anon callers get a
            signup prompt instead of the dialog (backend also 401s anon
            callers on the share endpoints as defense-in-depth). */}
        {activeChat && messages.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
            <div className="min-w-0 truncate text-sm font-medium" title={activeChatObj?.title}>
              {activeChatObj?.title || t("sidebar.newChat")}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => {
                if (isSignedIn) setShowShare(true);
                else setShowShareSignup(true);
              }}
              title={t("share.buttonHint")}
            >
              <Share2 className="size-4" />
              <span className="hidden sm:inline">{t("share.button")}</span>
            </Button>
          </div>
        )}

        <ChatThread
          messages={messages}
          loading={loading}
          thinkingLabel={t("thinking")}
          emptyLabel={t("empty")}
          onRate={rate}
          scrollRef={scrollRef}
          upLabel={t("feedback.up")}
          downLabel={t("feedback.down")}
          missingLabel={t("feedback.missing")}
          submitLabel={t("feedback.submit")}
          thanksLabel={t("feedback.thanks")}
        />

        {error && (
          <Alert variant="destructive" className="rounded-none border-x-0 border-b-0">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={send}
          loading={loading}
          placeholder={messages.length > 0 ? t("followUp") : t("placeholder")}
          sendLabel={t("getAnswer")}
        />
      </main>

      <SignupPromptDialog
        open={showSignupPrompt}
        onOpenChange={setShowSignupPrompt}
        strings={{
          title: t("signupPrompt.title"),
          body: t("signupPrompt.body"),
          primary: t("signupPrompt.primary"),
          secondary: t("signupPrompt.secondary"),
        }}
      />

      <UsageDialog
        open={showUsage}
        onOpenChange={setShowUsage}
        isSignedIn={isSignedIn}
        strings={{
          title: t("usage.title"),
          today: t("usage.today"),
          thisChat: t("usage.thisChat"),
          chatsValue: t("usage.chatsValue", {
            used: usage?.dailyChatsUsed ?? 0,
            limit: usage?.dailyChatsLimit ?? 0,
          }),
          messagesValue: t("usage.messagesValue", {
            used: activeChatObj?.messageCount ?? 0,
            limit: usage?.messagesPerChatLimit ?? 0,
          }),
          close: t("usage.close"),
          anonNote: t("usage.anonNote"),
        }}
      />

      <AccountDialog
        open={showAccount}
        onOpenChange={setShowAccount}
        usage={
          usage
            ? {
                today: t("usage.today"),
                thisChat: t("usage.thisChat"),
                chatsValue: t("usage.chatsValue", {
                  used: usage.dailyChatsUsed,
                  limit: usage.dailyChatsLimit,
                }),
                messagesValue: t("usage.messagesValue", {
                  used: activeChatObj?.messageCount ?? 0,
                  limit: usage.messagesPerChatLimit,
                }),
              }
            : null
        }
        strings={{
          title: t("account.title"),
          description: t("account.description"),
          usageHeading: t("account.usageHeading"),
          myTickets: t("account.myTickets"),
          myTicketsHint: t("account.myTicketsHint"),
          exportData: t("account.exportData"),
          exportDataHint: t("account.exportDataHint"),
          exportError: t("account.exportError"),
          deleteAccount: t("account.deleteAccount"),
          deleteAccountHint: t("account.deleteAccountHint"),
          deleteConfirmTitle: t("account.deleteConfirmTitle"),
          deleteConfirmBody: t("account.deleteConfirmBody"),
          deleteConfirmCta: t("account.deleteConfirmCta"),
          deleteCancel: t("account.deleteCancel"),
          deleteError: t("account.deleteError"),
          deleteSuccess: t("account.deleteSuccess"),
        }}
      />

      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        chatId={activeChat}
        strings={{
          dialogTitle: t("share.dialogTitle"),
          dialogDescription: t("share.dialogDescription"),
          creating: t("share.creating"),
          createError: t("share.createError"),
          copy: t("share.copy"),
          copied: t("share.copied"),
          copyFailed: t("share.copyFailed"),
          linkLabel: t("share.linkLabel"),
          revoke: t("share.revoke"),
          revoking: t("share.revoking"),
          revokeConfirmTitle: t("share.revokeConfirmTitle"),
          revokeConfirmBody: t("share.revokeConfirmBody"),
          revokeConfirmCta: t("share.revokeConfirmCta"),
          cancel: t("share.cancel"),
          revokeError: t("share.revokeError"),
          revokedNotice: t("share.revokedNotice"),
        }}
      />

      {/* Anon clicked Share -> prompt to sign up. Reuses SignupPromptDialog
          (same shape: title/body/primary/secondary). Sign-in lands back on
          "/", the active chat restores from localStorage, and the now-signed-in
          user can click Share for real. */}
      <SignupPromptDialog
        open={showShareSignup}
        onOpenChange={setShowShareSignup}
        strings={{
          title: t("share.signInToShareTitle"),
          body: t("share.signInToShareBody"),
          primary: t("signupPrompt.primary"),
          secondary: t("signupPrompt.secondary"),
        }}
      />
    </div>
  );
}
