"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getCommitInfo } from "@/lib/version";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/leads", label: "Leads" },
  { href: "/questions", label: "Questions" },
  { href: "/tickets", label: "Tickets" },
  { href: "/shares", label: "Shares" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const commit = getCommitInfo();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-card px-4 py-3">
        <span className="text-lg font-bold tracking-tight">leads.mongodb.help</span>
        <nav className="flex items-center gap-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        {/* Build commit: links to the exact source this dashboard was built
            from. Empty in local dev, populated by CI at Docker build time. */}
        {commit ? (
          <a
            href={commit.url}
            target="_blank"
            rel="noreferrer"
            title={`Built from commit ${commit.sha}`}
            className="ms-2 font-mono text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            {commit.short}
          </a>
        ) : null}
        <form action="/api/admin-logout" method="POST" className="ms-auto">
          <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
            <LogOut />
          </Button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
