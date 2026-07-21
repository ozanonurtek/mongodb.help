"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Status = "open" | "in_progress" | "resolved" | "closed";

type Ticket = {
  ticketId: string;
  subject: string;
  status: Status;
  createdAt: number;
  updatedAt: number;
};

type TicketMessage = {
  author: "user" | "admin";
  body: string;
  createdAt: number;
};

type TicketDetail = Ticket & {
  messages?: TicketMessage[];
};

type Strings = {
  title: string;
  subtitle: string;
  newTicket: string;
  subject: string;
  subjectPlaceholder: string;
  body: string;
  bodyPlaceholder: string;
  submit: string;
  submitting: string;
  empty: string;
  anonTitle: string;
  anonBody: string;
  anonCta: string;
  networkError: string;
  statusOpen: string;
  statusInProgress: string;
  statusResolved: string;
  statusClosed: string;
  back: string;
  conversation: string;
  replyPlaceholder: string;
  reply: string;
  replying: string;
  closedNotice: string;
  youLabel: string;
  staffLabel: string;
  conversationEmpty: string;
};

function statusLabel(s: Status, st: Strings): string {
  switch (s) {
    case "open":
      return st.statusOpen;
    case "in_progress":
      return st.statusInProgress;
    case "resolved":
      return st.statusResolved;
    default:
      return st.statusClosed;
  }
}

export function TicketsView({
  strings,
  prefillSubject,
  relatedQueryId,
}: {
  strings: Strings;
  prefillSubject?: string;
  relatedQueryId?: string;
}) {
  const { data: session, status } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState(prefillSubject ?? "");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!!prefillSubject);

  // Detail view state
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const r = await fetch(`/api/tickets/${session.user.id}`);
      if (r.ok) setTickets((await r.json()).tickets || []);
    } catch {}
  }, [session]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const r = await fetch(`/api/ticket/${id}`);
      if (!r.ok) {
        setDetailError(strings.networkError);
        return;
      }
      const d: TicketDetail = await r.json();
      setDetail(d);
    } catch {
      setDetailError(strings.networkError);
    } finally {
      setDetailLoading(false);
    }
  }, [strings.networkError]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === "loading") {
    return null;
  }

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 py-10">
        <h1 className="text-2xl font-bold">{strings.anonTitle}</h1>
        <p className="text-sm text-muted-foreground">{strings.anonBody}</p>
        <Button onClick={() => signIn(undefined, { callbackUrl: "/tickets" })} className="min-h-11">
          {strings.anonCta}
        </Button>
      </main>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          relatedQueryId: relatedQueryId || null,
        }),
      });
      if (!r.ok) {
        setError(strings.networkError);
        return;
      }
      setSubject("");
      setBody("");
      setShowForm(false);
      load();
    } catch {
      setError(strings.networkError);
    } finally {
      setLoading(false);
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || replying || !openTicketId) return;
    setReplying(true);
    try {
      const r = await fetch(`/api/ticket/${openTicketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (!r.ok) {
        setDetailError(strings.networkError);
        return;
      }
      setReply("");
      setDetailError(null);
      loadDetail(openTicketId);
      load();
    } catch {
      setDetailError(strings.networkError);
    } finally {
      setReplying(false);
    }
  }

  function closeDetail() {
    setOpenTicketId(null);
    setDetail(null);
    setDetailError(null);
    setReply("");
  }

  // --- Detail view ---
  if (openTicketId) {
    const isClosed = detail?.status === "closed";
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Button variant="ghost" size="sm" onClick={closeDetail} className="mb-4">
          ← {strings.back}
        </Button>

        {detailLoading && !detail && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {detailError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{detailError}</AlertDescription>
          </Alert>
        )}

        {detail && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-bold">{detail.subject}</h1>
              <p className="text-sm text-muted-foreground">
                {new Date(detail.createdAt * 1000).toLocaleString()} ·{" "}
                {statusLabel(detail.status, strings)}
              </p>
            </div>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {strings.conversation}
              </h2>
              {(detail.messages ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {strings.conversationEmpty}
                </p>
              ) : (
                (detail.messages ?? []).map((m, i) => {
                  const mine = m.author === "user";
                  return (
                    <div
                      key={i}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-prose rounded-lg border border-border p-3 text-sm ${
                          mine ? "bg-secondary" : "bg-card"
                        }`}
                      >
                        <div className="mb-1 text-xs text-muted-foreground">
                          {mine ? strings.youLabel : strings.staffLabel} ·{" "}
                          {new Date(m.createdAt * 1000).toLocaleString()}
                        </div>
                        <div className="whitespace-pre-wrap">{m.body}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            {isClosed ? (
              <p className="text-sm text-muted-foreground">
                {strings.closedNotice}
              </p>
            ) : (
              <form
                onSubmit={submitReply}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
              >
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{strings.reply}</span>
                  <textarea
                    required
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={strings.replyPlaceholder}
                    rows={4}
                    className="resize-y rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <Button type="submit" disabled={replying || !reply.trim()}>
                  {replying ? strings.replying : strings.reply}
                </Button>
              </form>
            )}
          </div>
        )}
      </main>
    );
  }

  // --- List view ---
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{strings.title}</h1>
          <p className="text-sm text-muted-foreground">{strings.subtitle}</p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            {strings.newTicket}
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-8 flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{strings.subject}</span>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={strings.subjectPlaceholder}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{strings.body}</span>
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={strings.bodyPlaceholder}
              rows={6}
              className="resize-y rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? strings.submitting : strings.submit}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setSubject("");
                setBody("");
              }}
            >
              {strings.newTicket}
            </Button>
          </div>
        </form>
      )}

      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.ticketId}>
              <button
                type="button"
                onClick={() => {
                  setOpenTicketId(t.ticketId);
                  setDetail(null);
                  setDetailError(null);
                  loadDetail(t.ticketId);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.createdAt * 1000).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {statusLabel(t.status, strings)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
