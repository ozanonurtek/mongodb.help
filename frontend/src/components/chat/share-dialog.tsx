"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Copy, Loader2, Share2, Trash2 } from "lucide-react";

type ShareInfo = { shareId: string; token: string; createdAt: number };

type Strings = {
  dialogTitle: string;
  dialogDescription: string;
  creating: string;
  createError: string;
  copy: string;
  copied: string;
  copyFailed: string;
  linkLabel: string;
  revoke: string;
  revoking: string;
  revokeConfirmTitle: string;
  revokeConfirmBody: string;
  revokeConfirmCta: string;
  cancel: string;
  revokeError: string;
  revokedNotice: string;
};

export function ShareDialog({
  open,
  onOpenChange,
  chatId,
  origin,
  strings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chatId: string | null;
  // Origin is passed in (rather than read from window) so SSR/CSR match and
  // so tests can stub it. Empty -> window.location.origin at render time.
  origin?: string;
  strings: Strings;
}) {
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revokedNotice, setRevokedNotice] = useState(false);

  // Refresh share status every time the dialog opens (handles "revoked
  // elsewhere, recreated" etc). Reset transient UI state on close.
  useEffect(() => {
    if (!open || !chatId) return;
    setError(null);
    setCopied(false);
    setConfirmRevoke(false);
    setRevokedNotice(false);
    setLoading(true);
    fetch(`/api/chats/${chatId}/share`)
      .then(async (r) => {
        if (r.status === 404) return null; // inactive — not an error
        if (!r.ok) throw new Error("status");
        return (await r.json()) as ShareInfo;
      })
      .then((info) => setShare(info))
      .catch(() => setError(strings.createError))
      .finally(() => setLoading(false));
  }, [open, chatId, strings.createError]);

  async function createLink() {
    if (!chatId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${chatId}/share`, { method: "POST" });
      if (!res.ok) throw new Error("create");
      const info = (await res.json()) as ShareInfo;
      setShare(info);
    } catch {
      setError(strings.createError);
    } finally {
      setCreating(false);
    }
  }

  async function revokeLink() {
    if (!chatId) return;
    setRevoking(true);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${chatId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error("revoke");
      setShare(null);
      setConfirmRevoke(false);
      setRevokedNotice(true);
    } catch {
      setError(strings.revokeError);
    } finally {
      setRevoking(false);
    }
  }

  async function copyLink() {
    if (!share) return;
    const url = buildShareUrl(share.token, origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Brief feedback; reset after a few seconds so the label is honest.
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select the input text so the user can Cmd/Ctrl-C.
      const el = document.getElementById("mh-share-url") as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
      setError(strings.copyFailed);
      setTimeout(() => setError(null), 3000);
    }
  }

  const url = share ? buildShareUrl(share.token, origin) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-4" />
            {strings.dialogTitle}
          </DialogTitle>
          <DialogDescription>{strings.dialogDescription}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="me-2 size-4 animate-spin" />
          </div>
        ) : share ? (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              {strings.linkLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="mh-share-url"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyLink}
                aria-label={strings.copy}
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span className="hidden sm:inline">
                  {copied ? strings.copied : strings.copy}
                </span>
              </Button>
            </div>

            {revokedNotice ? (
              <p className="text-xs text-muted-foreground">{strings.revokedNotice}</p>
            ) : null}

            {!confirmRevoke ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmRevoke(true)}
                >
                  <Trash2 className="size-4" />
                  {strings.revoke}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium">{strings.revokeConfirmTitle}</p>
                <p className="text-xs text-muted-foreground">{strings.revokeConfirmBody}</p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmRevoke(false)}
                    disabled={revoking}
                  >
                    {strings.cancel}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={revokeLink}
                    disabled={revoking}
                  >
                    {revoking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      strings.revokeConfirmCta
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {revokedNotice ? (
              <p className="text-xs text-muted-foreground">{strings.revokedNotice}</p>
            ) : null}
            <Button
              type="button"
              onClick={createLink}
              disabled={creating}
              className="w-full"
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Share2 className="size-4" />
              )}
              {strings.dialogTitle}
            </Button>
          </div>
        )}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function buildShareUrl(token: string, origin?: string): string {
  // Bare path (no locale prefix): next-intl will negotiate the recipient's
  // preferred locale on hit. Keeps links stable across sender locale + future
  // locale additions, and shortens URLs in the common (en) case.
  const base =
    origin && origin.length > 0
      ? origin
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  return `${base}/shared/${token}`;
}
