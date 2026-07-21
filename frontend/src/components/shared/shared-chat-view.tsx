"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { BackToChat } from "@/components/back-to-chat";
import { Loader2, Copy, LogIn } from "lucide-react";
import { Link } from "@/i18n/routing";

type Msg = {
  role: "user" | "assistant";
  content: string;
  citations?: { title: string; url: string }[];
};

type SharedChat = {
  token: string;
  title?: string;
  messageCount: number;
  messages: Msg[];
};

type Status = "loading" | "ready" | "notfound" | "error";

type Strings = {
  sharedPageTitle: string;
  sharedSubtitle: string;
  notFound: string;
  loadError: string;
  messageCount: string;
  copyCta: string;
  copyHint: string;
  copying: string;
  copySuccess: string;
  copyError: string;
  copyLimit: string;
  signInToCopy: string;
  signInHint: string;
  openChat: string;
  thinkingLabel: string;
  emptyLabel: string;
  backLabel: string;
};

export function SharedChatView({ token, strings }: { token: string; strings: Strings }) {
  const t = useTranslations();
  const router = useRouter();
  const { status } = useSession();
  const signedIn = status === "authenticated";

  const [chat, setChat] = useState<SharedChat | null>(null);
  const [statusState, setStatusState] = useState<Status>("loading");
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const load = useCallback(async () => {
    setStatusState("loading");
    try {
      const res = await fetch(`/api/shared/${token}`);
      if (res.status === 404) {
        setStatusState("notfound");
        return;
      }
      if (!res.ok) {
        setStatusState("error");
        return;
      }
      const data = (await res.json()) as SharedChat;
      setChat(data);
      setStatusState("ready");
    } catch {
      setStatusState("error");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyToAccount() {
    if (copying) return;
    setCopying(true);
    setCopyError(null);
    try {
      const res = await fetch(`/api/shared/${token}/fork`, { method: "POST" });
      if (res.status === 401) {
        // Anon somehow tried — route to sign-in (shouldn't happen because the
        // button is gated on signedIn, but be defensive). Preserve the share
        // URL as callbackUrl so we come back here, not to /.
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/shared/${token}`)}`);
        return;
      }
      if (res.status === 429) {
        setCopyError(strings.copyLimit);
        return;
      }
      if (res.status === 404) {
        setStatusState("notfound");
        return;
      }
      if (!res.ok) {
        setCopyError(strings.copyError);
        return;
      }
      const data = (await res.json()) as { chatId: string };
      // Prime the main page's restore-from-localStorage so the user lands on
      // their fresh copy instead of a blank chat.
      try {
        localStorage.setItem("mh:activeChat", data.chatId);
      } catch {
        // ignore quota / privacy-mode failures; user can still pick the chat
        // from the sidebar.
      }
      setCopySuccess(true);
      // Brief success flash before redirect so the action feels acknowledged.
      setTimeout(() => router.push("/"), 600);
    } catch {
      setCopyError(strings.copyError);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <BackToChat label={strings.backLabel} />

      {statusState === "loading" ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="me-2 size-4 animate-spin" />
        </div>
      ) : null}

      {statusState === "notfound" ? (
        <Alert>
          <AlertDescription>{strings.notFound}</AlertDescription>
        </Alert>
      ) : null}

      {statusState === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{strings.loadError}</AlertDescription>
        </Alert>
      ) : null}

      {statusState === "ready" && chat ? (
        <>
          <header className="flex flex-col gap-3 border-b border-border pb-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold leading-tight">
                {chat.title || strings.sharedPageTitle}
              </h1>
              <p className="text-xs text-muted-foreground">
                {strings.sharedSubtitle} ·{" "}
                {t("share.messageCount", { count: chat.messageCount })}
              </p>
            </div>

            {/* Copy CTA — gated by signed-in status. Anon visitors get a
                sign-in route with this page as callbackUrl, so they return
                here after OAuth instead of landing on /. No anon-copy path on
                the backend means there is no same-IP bypass even when many
                people open the same link. */}
            <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {signedIn ? strings.copyCta : strings.signInToCopy}
                </p>
                <p className="text-xs text-muted-foreground">
                  {signedIn ? strings.copyHint : strings.signInHint}
                </p>
              </div>
              <div className="shrink-0">
                {signedIn ? (
                  <Button onClick={copyToAccount} disabled={copying || copySuccess}>
                    {copying ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copying
                      ? strings.copying
                      : copySuccess
                        ? strings.copySuccess
                        : strings.copyCta}
                  </Button>
                ) : (
                  <Button asChild>
                    <Link
                      href={`/auth/signin?callbackUrl=${encodeURIComponent(`/shared/${token}`)}`}
                    >
                      <LogIn className="size-4" />
                      {strings.signInToCopy}
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {copyError ? (
              <Alert variant="destructive">
                <AlertDescription>{copyError}</AlertDescription>
              </Alert>
            ) : null}
          </header>

          <div className="flex flex-col gap-4 pb-8">
            {chat.messages.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {strings.emptyLabel}
              </p>
            ) : (
              chat.messages.map((m, i) => (
                <ChatBubble
                  key={i}
                  role={m.role}
                  content={m.content}
                  citations={m.citations}
                  // No queryId + no onRate => no feedback UI on a read-only
                  // shared view. Copies regain feedback on new answers.
                />
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
