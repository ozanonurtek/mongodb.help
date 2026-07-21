import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { AppSessionProvider } from "@/components/session-provider";
import { SiteHeader } from "@/components/site-header";
import "../globals.css";

export const BR = "#F54927";

export const viewport: Viewport = {
  themeColor: BR,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
    applicationName: "mongodb.help",
    appleWebApp: {
      capable: true,
      title: "mongodb.help",
      statusBarStyle: "default",
    },
    formatDetection: {
      telephone: false,
    },
    // Icons (icon.svg, favicon.ico, apple-icon.png in app/) are auto-detected
    // by Next.js file conventions, no manual `icons` config needed.
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={dir}>
      <body className="flex h-dvh flex-col overflow-hidden overscroll-none">
        <NextIntlClientProvider messages={messages}>
          <AppSessionProvider>
            <SiteHeader />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              {children}
            </div>
          </AppSessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
