import { getLocale, getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/auth/sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth" });
  const sp = await searchParams;
  const coolOffHours = Number(process.env.DELETE_COOL_OFF_HOURS ?? "24");
  return (
    <SignInForm
      error={sp.error}
      // Preserve the page the user was on (e.g. /shared/{token}) so we come
      // back there after OAuth, instead of always landing on /.
      callbackUrl={sp.callbackUrl}
      coolOffHours={coolOffHours}
      strings={{
        signInTitle: t("signInTitle"),
        signInSubtitle: t("signInSubtitle"),
        continueGitHub: t("continueGitHub"),
        continueGoogle: t("continueGoogle"),
        coolOffTitle: t("coolOffTitle", { hours: coolOffHours }),
        coolOffBody: t("coolOffBody", { hours: coolOffHours }),
      }}
    />
  );
}
