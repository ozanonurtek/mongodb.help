"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/chat/language-switcher";
import { AuthButton } from "@/components/chat/auth-button";

export function SiteHeader() {
  const t = useTranslations();
  const { status } = useSession();
  const signedIn = status === "authenticated";
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 [padding-top:env(safe-area-inset-top)]">
      <Link href="/" aria-label={t("title")} className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-wordmark.svg"
          alt={t("title")}
          className="h-15 w-auto transition-opacity hover:opacity-80 pt-1"
        />
      </Link>
      <div className="ms-auto flex items-center gap-1">
        <LanguageSwitcher ariaLabel={t("language")} />
        <AuthButton
          signInLabel={t("auth.signIn")}
          signOutLabel={t("auth.signOut")}
        />
      </div>
    </header>
  );
}
