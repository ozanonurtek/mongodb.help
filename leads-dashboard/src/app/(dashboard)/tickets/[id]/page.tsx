"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import type { Ticket, TicketStatus } from "@/types";

const STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

type Message = { author: string; body: string; createdAt: number };

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetch(`/api/admin/tickets/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Ticket) => {
        if (alive) setTicket(d);
      })
      .catch(() => {
        if (alive) setError("Failed to load");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  async function changeStatus(next: TicketStatus) {
    if (!ticket || next === ticket.status || saving) return;
    setSaving(true);
    const prev = ticket.status;
    setTicket({ ...ticket, status: next });
    try {
      const r = await fetch(`/api/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setTicket({ ...ticket, status: prev });
    } finally {
      setSaving(false);
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || replying || !id) return;
    setReplying(true);
    setReplyError(null);
    try {
      const r = await fetch(`/api/admin/tickets/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (!r.ok) throw new Error();
      setReply("");
      // Refresh ticket to show the new message + bumped updatedAt.
      const fresh = await fetch(`/api/admin/tickets/${id}`).then((r) => r.json());
      setTicket(fresh as Ticket);
    } catch {
      setReplyError("Failed to send reply");
    } finally {
      setReplying(false);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!ticket) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/tickets" className="text-sm text-muted-foreground hover:underline">
          ← Tickets
        </Link>
        <h1 className="text-xl font-semibold">{ticket.subject}</h1>
        <p className="text-sm text-muted-foreground">
          {ticket.email || "no email"} · opened {fmtDate(ticket.createdAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <select
            value={ticket.status}
            onChange={(e) => changeStatus(e.target.value as TicketStatus)}
            disabled={saving}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {saving && <span className="text-xs text-muted-foreground">saving…</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(ticket.messages ?? []).map((m: Message, i: number) => (
            <div
              key={i}
              className={`max-w-prose rounded-lg border border-border p-3 text-sm ${
                m.author === "admin" ? "bg-secondary" : "bg-card"
              }`}
            >
              <div className="mb-1 text-xs text-muted-foreground">
                {m.author === "admin" ? "Admin" : "User"} · {fmtDate(m.createdAt)}
              </div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reply</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitReply} className="flex flex-col gap-3">
            <textarea
              required
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type a reply to the user…"
              rows={4}
              className="resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {replyError && (
              <p className="text-xs text-destructive">{replyError}</p>
            )}
            <div>
              <Button type="submit" disabled={replying || !reply.trim()}>
                {replying ? "Sending…" : "Send reply"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );

}
