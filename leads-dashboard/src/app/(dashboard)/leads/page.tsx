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
import type { Lead } from "@/types";

export default function LeadsPage() {
  const { data, error } = useApi<{ leads: Lead[] }>("/api/admin/leads");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Signed-up users, your potential customers. Sorted by engagement.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{data ? `${data.leads.length} leads` : "Loading…"}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">👎</TableHead>
                  <TableHead>Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link href={`/leads/${l.id}`} className="hover:underline">
                        {l.email || <span className="text-muted-foreground">no email</span>}
                      </Link>
                      {l.name && (
                        <div className="text-xs text-muted-foreground">{l.name}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs uppercase text-muted-foreground">
                      {l.providers.join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.questionCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.ticketCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.negativeFeedbackCount > 0 ? l.negativeFeedbackCount : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtRelative(l.lastActive ?? l.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {data.leads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No leads yet.
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
