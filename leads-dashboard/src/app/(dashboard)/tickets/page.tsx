"use client";

import Link from "next/link";
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
import { fmtRelative } from "@/lib/format";
import type { Ticket, TicketStatus } from "@/types";

const STATUS_TONE: Record<TicketStatus, string> = {
  open: "text-warn",
  in_progress: "text-primary",
  resolved: "text-success",
  closed: "text-muted-foreground",
};

export default function TicketsPage() {
  const { data, error } = useApi<{ tickets: Ticket[] }>("/api/admin/tickets");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Support requests, each one is a warm lead.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{data ? `${data.tickets.length} tickets` : "Loading…"}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
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
                    <TableCell className="text-xs">{t.email || "—"}</TableCell>
                    <TableCell className={`text-xs font-medium ${STATUS_TONE[t.status]}`}>
                      {t.status}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtRelative(t.updatedAt ?? t.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {data.tickets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No tickets yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
