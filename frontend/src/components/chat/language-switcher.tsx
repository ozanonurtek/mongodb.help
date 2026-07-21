"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname, routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Check, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// Native names are constant across locales (they don't need translation).
const NATIVE_NAMES: Record<string, string> = {
  en: "English",
  tr: "Türkçe",
  fr: "Français",
  es: "Español",
  ar: "العربية",
  de: "Deutsch",
  ru: "Русский",
};

export function LanguageSwitcher({ ariaLabel }: { ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const active = useLocale();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function select(locale: string) {
    setOpen(false);
    if (locale !== active) router.replace(pathname, { locale });
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Globe className="size-5" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-1 min-w-40 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {routing.locales.map((locale) => (
            <button
              key={locale}
              type="button"
              role="menuitemradio"
              aria-checked={locale === active}
              onClick={() => select(locale)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                locale === active && "font-medium text-primary"
              )}
            >
              <span className={cn(locale === "ar" && "font-sans")}>
                {NATIVE_NAMES[locale] ?? locale}
              </span>
              {locale === active && <Check className="size-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
