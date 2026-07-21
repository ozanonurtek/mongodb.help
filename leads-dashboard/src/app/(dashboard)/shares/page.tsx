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
import type { ShareRow } from "@/types";

export default function SharesPage() {
  const { data, error } = useApi<{ shares: ShareRow[]; total: number }>(
    "/api/admin/shares",
  );

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Shared chats</h1>
        <p className="text-sm text-muted-foreground">
          Active share links and how many signed-in visitors forked each into
          their own copy. Sorted by forks, then views.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{data.total} active share link(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No chats have been shared yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chat</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Forks</TableHead>
                  <TableHead className="text-right">Conv.</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.shares.map((s) => {
                  const conv =
                    s.views > 0 ? Math.round((s.forks / s.views) * 100) : 0;
                  return (
                    <TableRow key={s.shareId}>
                      <TableCell className="max-w-xs truncate">
                        {s.title || (
                          <span className="font-mono text-xs text-muted-foreground">
                            {s.chatId.slice(0, 8)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.ownerEmail ? (
                          <Link
                            href={`/leads/${s.ownerId}`}
                            className="hover:underline"
                          >
                            {s.ownerEmail}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">anon</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.views}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {s.forks}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {conv}%
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtRelative(s.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
