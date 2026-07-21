import { getLocale, getTranslations } from "next-intl/server";
import { TicketsView } from "@/components/tickets/tickets-view";
import { BackToChat } from "@/components/back-to-chat";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; relatedQueryId?: string }>;
}) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "tickets" });
  const tg = await getTranslations({ locale });
  const sp = await searchParams;
  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4 pt-6">
        <BackToChat label={tg("backToChat")} />
      </div>
      <TicketsView
        prefillSubject={sp.subject}
        relatedQueryId={sp.relatedQueryId}
        strings={{
          title: t("title"),
          subtitle: t("subtitle"),
          newTicket: t("newTicket"),
          subject: t("subject"),
          subjectPlaceholder: t("subjectPlaceholder"),
          body: t("body"),
          bodyPlaceholder: t("bodyPlaceholder"),
          submit: t("submit"),
          submitting: t("submitting"),
          empty: t("empty"),
          anonTitle: t("anonTitle"),
          anonBody: t("anonBody"),
          anonCta: t("anonCta"),
          networkError: tg("networkError"),
          statusOpen: t("statusOpen"),
          statusInProgress: t("statusInProgress"),
          statusResolved: t("statusResolved"),
          statusClosed: t("statusClosed"),
          back: t("back"),
          conversation: t("conversation"),
          replyPlaceholder: t("replyPlaceholder"),
          reply: t("reply"),
          replying: t("replying"),
          closedNotice: t("closedNotice"),
          youLabel: t("youLabel"),
          staffLabel: t("staffLabel"),
          conversationEmpty: t("conversationEmpty"),
        }}
      />
    </>
  );
}
