"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, Gauge, LifeBuoy, Loader2, Trash2 } from "lucide-react";
import { Link } from "@/i18n/routing";

type UsageStrings = {
  today: string;
  thisChat: string;
  chatsValue: string;
  messagesValue: string;
};

type Strings = {
  title: string;
  description: string;
  usageHeading: string;
  myTickets: string;
  myTicketsHint: string;
  exportData: string;
  exportDataHint: string;
  exportError: string;
  deleteAccount: string;
  deleteAccountHint: string;
  deleteConfirmTitle: string;
  deleteConfirmBody: string;
  deleteConfirmCta: string;
  deleteCancel: string;
  deleteError: string;
  deleteSuccess: string;
};

export function AccountDialog({
  open,
  onOpenChange,
  usage,
  strings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usage: UsageStrings | null;
  strings: Strings;
}) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/account/export`);
      if (!res.ok) throw new Error("export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `mongodb-help-account-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(strings.exportError);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/account`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      await signOut({ redirect: false });
      setConfirmingDelete(false);
      onOpenChange(false);
      router.refresh();
    } catch {
      setDeleteError(strings.deleteError);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{strings.title}</DialogTitle>
            <DialogDescription>{strings.description}</DialogDescription>
          </DialogHeader>

          <section className="flex flex-col gap-1">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Gauge className="size-4" />
              {strings.usageHeading}
            </h3>
            {usage ? (
              <div className="ms-6 text-sm">
                <div className="text-muted-foreground">{usage.today}</div>
                <div className="font-medium tabular-nums">{usage.chatsValue}</div>
                <div className="mt-1 text-muted-foreground">{usage.thisChat}</div>
                <div className="font-medium tabular-nums">{usage.messagesValue}</div>
              </div>
            ) : null}
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <Row
              icon={<LifeBuoy className="size-4" />}
              label={strings.myTickets}
              hint={strings.myTicketsHint}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <Link href="/tickets">{strings.myTickets}</Link>
                </Button>
              }
            />
            <Row
              icon={<Download className="size-4" />}
              label={strings.exportData}
              hint={strings.exportDataHint}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    strings.exportData
                  )}
                </Button>
              }
            />
            {exportError ? (
              <p className="ms-6 text-sm text-destructive">{exportError}</p>
            ) : null}
            <Row
              icon={<Trash2 className="size-4 text-destructive" />}
              label={strings.deleteAccount}
              hint={strings.deleteAccountHint}
              action={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmingDelete(true)}
                >
                  {strings.deleteAccount}
                </Button>
              }
            />
          </section>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{strings.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>{strings.deleteConfirmBody}</DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              {strings.deleteCancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                strings.deleteConfirmCta
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({
  icon,
  label,
  hint,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
