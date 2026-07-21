"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Strings = {
  title: string;
  today: string;
  thisChat: string;
  chatsValue: string;
  messagesValue: string;
  close: string;
  anonNote: string;
};

export function UsageDialog({
  open,
  onOpenChange,
  isSignedIn,
  strings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isSignedIn: boolean;
  strings: Strings;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{strings.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">{strings.today}</div>
            <div className="font-medium tabular-nums">{strings.chatsValue}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{strings.thisChat}</div>
            <div className="font-medium tabular-nums">{strings.messagesValue}</div>
          </div>
          {!isSignedIn && (
            <p className="text-muted-foreground">{strings.anonNote}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
