"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AuthButton({
  signInLabel,
  signOutLabel,
}: {
  signInLabel: string;
  signOutLabel: string;
}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="size-9" />;
  }

  if (!session?.user) {
    return (
      <Button size="sm" onClick={() => signIn()}>
        {signInLabel}
      </Button>
    );
  }

  const name = session.user.name || session.user.email || "Account";
  return (
    <div className="flex items-center gap-1">
      <span className="hidden max-w-[10rem] truncate text-sm text-muted-foreground sm:inline">
        {name}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={signOutLabel}
        title={signOutLabel}
        onClick={() => signOut()}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
