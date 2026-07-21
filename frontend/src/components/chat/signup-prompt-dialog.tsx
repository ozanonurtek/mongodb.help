"use client";

import { signIn } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Strings = {
  title: string;
  body: string;
  primary: string;
  secondary: string;
};

export function SignupPromptDialog({
  open,
  onOpenChange,
  strings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  strings: Strings;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{strings.title}</DialogTitle>
          <DialogDescription>{strings.body}</DialogDescription>
        </DialogHeader>
        <Button onClick={() => signIn(undefined, { callbackUrl: "/" })}>
          {strings.primary}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
