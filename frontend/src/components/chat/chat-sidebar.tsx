"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Gauge, Menu, MessageSquarePlus, UserCircle } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getCommitInfo } from "@/lib/version";

function SidebarBody({
  chats,
  activeChat,
  onNewChat,
  onSelectChat,
  newChatLabel,
  chatsLabel,
  legal,
  signedIn,
  onShowUsage,
  usageLabel,
  accountLabel,
}: {
  chats: { chatId: string; title?: string; preview?: string }[];
  activeChat: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  newChatLabel: string;
  chatsLabel: string;
  legal: { disclaimer: string; terms: string; privacy: string };
  signedIn: boolean;
  onShowUsage: () => void;
  usageLabel: string;
  accountLabel: string;
}) {
  return (
    <div className="flex h-full flex-col bg-card">
      <nav className="flex-1 overflow-y-auto p-3">
        {chats.length === 0 ? (
          <p className="whitespace-nowrap px-2 py-1 text-sm text-muted-foreground">{chatsLabel}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {chats.map((c) => (
              <li key={c.chatId}>
                <button
                  type="button"
                  onClick={() => onSelectChat(c.chatId)}
                  className={
                    "w-full truncate rounded-md border-s-2 px-2 py-1.5 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (c.chatId === activeChat
                      ? "border-primary bg-secondary text-secondary-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground")
                  }
                >
                  {c.title || c.preview || c.chatId.slice(0, 8)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <Separator />
      <div className="flex flex-col gap-2 p-3">
        <Button variant="outline" className="w-full" onClick={onNewChat} title={newChatLabel}>
          <MessageSquarePlus className="size-4 shrink-0" />
          <span className="truncate">{newChatLabel}</span>
        </Button>
        <div className="flex flex-col gap-1 text-sm">
          <button
            type="button"
            onClick={onShowUsage}
            className="flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-start text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {signedIn ? (
              <UserCircle className="size-4 shrink-0" />
            ) : (
              <Gauge className="size-4 shrink-0" />
            )}
            {signedIn ? accountLabel : usageLabel}
          </button>
        </div>
      </div>
      <Separator />
      <footer className="flex flex-col gap-1 p-3 text-xs text-muted-foreground">
        {[
          [legal.disclaimer, "/legal/disclaimer"],
          [legal.terms, "/legal/terms"],
          [legal.privacy, "/legal/privacy"],
        ].map(([label, href]) => (
          <Link key={href as string} href={href as string} className="whitespace-nowrap hover:text-foreground">
            {label}
          </Link>
        ))}
        {(() => {
          // Build-identification link: the commit this image was built from.
          // getCommitInfo() reads NEXT_PUBLIC_GIT_COMMIT_SHA, which is empty
          // in local dev (the link then doesn't render) and populated by CI
          // at Docker build time. Links to the exact source on GitHub.
          const commit = getCommitInfo();
          if (!commit) return null;
          return (
            <a
              href={commit.url}
              target="_blank"
              rel="noreferrer"
              title={`Built from commit ${commit.sha}`}
              className="mt-1 font-mono text-[0.65rem] text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              {commit.short}
            </a>
          );
        })()}
      </footer>
    </div>
  );
}

export function ChatSidebar(
  props: Parameters<typeof SidebarBody>[0]
) {
  return (
    <aside className="hidden h-full w-60 shrink-0 border-e border-border bg-card md:block">
      <SidebarBody {...props} />
    </aside>
  );
}

export function ChatSidebarTrigger(
  props: Parameters<typeof SidebarBody>[0] & { label: string }
) {
  const { label, onNewChat, onSelectChat, onShowUsage, ...rest } = props;
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={label}
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 bg-card p-0 sm:max-w-60">
        <SidebarBody
          {...rest}
          onNewChat={() => {
            onNewChat();
            close();
          }}
          onSelectChat={(id) => {
            onSelectChat(id);
            close();
          }}
          onShowUsage={() => {
            onShowUsage();
            close();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
