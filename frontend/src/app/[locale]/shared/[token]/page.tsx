import { getLocale, getTranslations } from "next-intl/server";
import { SharedChatView } from "@/components/shared/shared-chat-view";

export const dynamic = "force-dynamic";

export default async function SharedChatPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "share" });
  const tg = await getTranslations({ locale });

  return (
    <SharedChatView
      token={token}
      strings={{
        sharedPageTitle: t("sharedPageTitle"),
        sharedSubtitle: t("sharedSubtitle"),
        notFound: t("notFound"),
        loadError: t("loadError"),
        messageCount: t("messageCount"),
        copyCta: t("copyCta"),
        copyHint: t("copyHint"),
        copying: t("copying"),
        copySuccess: t("copySuccess"),
        copyError: t("copyError"),
        copyLimit: t("copyLimit"),
        signInToCopy: t("signInToCopy"),
        signInHint: t("signInHint"),
        openChat: t("openChat"),
        thinkingLabel: tg("thinking"),
        emptyLabel: tg("empty"),
        backLabel: tg("backToChat"),
      }}
    />
  );
}
