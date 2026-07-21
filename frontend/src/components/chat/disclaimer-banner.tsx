"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const SESSION_KEY = "mh:disclaimer-dismissed";

export function DisclaimerBanner({
  text,
  linkLabel,
  linkHref,
}: {
  text: string;
  linkLabel: string;
  linkHref: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) setDismissed(true);
    } catch {}
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
  }

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-2 border-b border-border bg-card px-4 py-2 text-xs text-muted-foreground">
      <span className="min-w-0 flex-1">
        {text}{" "}
        <a href={linkHref} className="underline hover:text-foreground">
          {linkLabel}
        </a>
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
