"use client";

import { signIn } from "next-auth/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Strings = {
  signInTitle: string;
  signInSubtitle: string;
  continueGitHub: string;
  continueGoogle: string;
  coolOffTitle: string;
  coolOffBody: string;
};

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function SignInForm({
  error,
  callbackUrl,
  strings,
}: {
  error?: string;
  // Where to land after a successful OAuth round-trip. Defaults to "/" for
  // plain sign-ins; callers that need to resume a flow (e.g. cloning a shared
  // chat) pass their current path so we come back to it. Sanitized below to
  // defang open-redirect attempts via a tampered query string.
  callbackUrl?: string;
  coolOffHours?: number;
  strings: Strings;
}) {
  const blocked = error === "AccountRecentlyDeleted";
  // Only same-origin relative paths are safe to redirect to. A bare `/` or
  // anything starting with `//` (protocol-relative) or an absolute URL must
  // fall back to home, otherwise a crafted callbackUrl=?https://evil would
  // bounce users off-site post-login.
  const safeCallback =
    callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/";
  // h-full (not min-h-dvh): this component lives inside the locale layout's
  // flex-1 children container, which is already viewport-height minus the site
  // header. min-h-dvh would make the form taller than its parent -> overflow
  // + a phantom scrollbar, and justify-center would center against the
  // oversized form (so content looked off-center against the visible area).
  // h-full makes the form exactly fill the parent; justify-center then centers
  // content in the actual visible region.
  return (
    <main className="mx-auto flex h-full max-w-sm flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-bold">{strings.signInTitle}</h1>
      <p className="text-sm text-muted-foreground">{strings.signInSubtitle}</p>

      {blocked && (
        <Alert variant="destructive">
          <AlertTitle>{strings.coolOffTitle}</AlertTitle>
          <AlertDescription>{strings.coolOffBody}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => signIn("github", { callbackUrl: safeCallback })}
          variant="outline"
          className="min-h-11"
          disabled={blocked}
        >
          <GitHubMark />
          {strings.continueGitHub}
        </Button>
        <Button
          onClick={() => signIn("google", { callbackUrl: safeCallback })}
          variant="outline"
          className="min-h-11"
          disabled={blocked}
        >
          <GoogleMark />
          {strings.continueGoogle}
        </Button>
      </div>
    </main>
  );
}
