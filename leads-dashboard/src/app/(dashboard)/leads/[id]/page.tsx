"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { fmtDate } from "@/lib/format";
import type { Lead, AdminQuestion, Ticket } from "@/types";

type LeadDetail = Lead & {
  questions: AdminQuestion[];
  tickets: Ticket[];
};

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, error } = useApi<LeadDetail>(`/api/admin/leads/${id}`);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/leads" className="text-sm text-muted-foreground hover:underline">
          ← Leads
        </Link>
        <h1 className="text-xl font-semibold">{data.email || data.name || data.id}</h1>
        <p className="text-sm text-muted-foreground">
          {data.name && data.email ? data.name : ""}
          {data.providers.length > 0
            ? ` · signed in via ${data.providers.join(", ")}`
            : ""}
          {` · joined ${fmtDate(data.createdAt)}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold tabular-nums">{data.questionCount}</div>
            <div className="text-xs text-muted-foreground">questions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold tabular-nums">{data.ticketCount}</div>
            <div className="text-xs text-muted-foreground">tickets</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold tabular-nums">{data.negativeFeedbackCount}</div>
            <div className="text-xs text-muted-foreground">negative feedback</div>
          </CardContent>
        </Card>
      </div>

      {/* Share engagement: a lead whose shared chats get forked is high-value
          — their content is pulling new viewers into signups. */}
      {data.shares ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-bold tabular-nums">{data.shares.created}</div>
              <div className="text-xs text-muted-foreground">share links created</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-bold tabular-nums">
                {data.shares.totalForks}
              </div>
              <div className="text-xs text-muted-foreground">
                forks by other users of their shares
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent>
          {data.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-md truncate font-mono text-xs">
                      {q.inputRedacted}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{q.classifiedType}</TableCell>
                    <TableCell className="text-xs">{q.feedback ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(q.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {data.tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/tickets/${t.id}`} className="hover:underline">
                        {t.subject}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.status}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(t.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
