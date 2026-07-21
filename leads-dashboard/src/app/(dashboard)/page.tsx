"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/lib/use-api";
import type { Stats } from "@/types";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const { data, error } = useApi<Stats>("/api/admin/stats");

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  // Forks-per-view conversion: the share feature's lead-gen effectiveness.
  // A low rate means content gets viewed but doesn't pull viewers into a
  // signed-in copy; a high rate means shares are converting.
  const forkRate =
    data.shares.totalViews > 0
      ? Math.round((data.shares.forks.total / data.shares.totalViews) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Lead-gen funnel at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Signups"
          value={String(data.users.total)}
          sub={`${data.users.last24h} today · ${data.users.last7d} this week`}
        />
        <StatCard
          label="Questions"
          value={String(data.questions.total)}
          sub={`${data.questions.signedIn} signed-in · ${data.questions.anonymous} anon`}
        />
        <StatCard
          label="Feedback 👍"
          value={String(data.questions.up)}
          sub={`${data.questions.down} 👎 · ${
            data.questions.up + data.questions.down > 0
              ? Math.round(
                  (data.questions.up / (data.questions.up + data.questions.down)) * 100
                )
              : 0
          }% positive`}
        />
        <StatCard
          label="Open tickets"
          value={String(data.tickets.open ?? 0)}
          sub={`${(data.tickets.in_progress ?? 0)} in progress · ${(data.tickets.resolved ?? 0)} resolved`}
        />
        <StatCard
          label="Share links"
          value={String(data.shares.total)}
          sub={`${data.shares.last24h} today · ${data.shares.last7d} this week`}
        />
        <StatCard
          label="Forks of shared chats"
          value={String(data.shares.forks.total)}
          sub={`${data.shares.forks.last24h} today · each fork = a new signup-eligible visitor`}
        />
        <StatCard
          label="Share views"
          value={String(data.shares.totalViews)}
          sub={`top of the share funnel`}
        />
        <StatCard
          label="View → fork rate"
          value={`${forkRate}%`}
          sub={`signed-in conversion on shared chats`}
        />
      </div>
    </div>
  );
}
