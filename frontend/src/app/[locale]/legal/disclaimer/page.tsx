import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { BackToChat } from "@/components/back-to-chat";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: `mongodb.help, ${t("disclaimer")}` };
}

export default function DisclaimerPage() {
  const t = useTranslations("legal");
  const tg = useTranslations();
  return (
    <article className="mx-auto max-w-prose px-6 py-10 text-base leading-relaxed text-foreground">
      <BackToChat label={tg("backToChat")} className="mb-6" />
      <h1 className="mb-4 text-2xl font-bold">{t("disclaimerTitle")}</h1>
      <p>{t("disclaimerText")}</p>
    </article>
  );
}
