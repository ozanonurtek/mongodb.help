import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["en", "tr", "fr", "es", "ar", "de", "ru"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export const config = {
  // /auth/* goes through i18n too (the signin page lives under [locale]);
  // /api/auth/* is still excluded via the api segment.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
