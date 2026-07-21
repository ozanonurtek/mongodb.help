import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./chat-bubble";

type Msg = {
  role: "user" | "assistant";
  content: string;
  citations?: { title: string; url: string }[];
  queryId?: string;
  rating?: number;
};

export function ChatThread({
  messages,
  loading,
  thinkingLabel,
  emptyLabel,
  onRate,
  scrollRef,
  upLabel,
  downLabel,
  missingLabel,
  submitLabel,
  thanksLabel,
}: {
  messages: Msg[];
  loading: boolean;
  thinkingLabel: string;
  emptyLabel: string;
  onRate: (queryId: string, rating: number, note?: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  upLabel?: string;
  downLabel?: string;
  missingLabel?: string;
  submitLabel?: string;
  thanksLabel?: string;
}) {
  const hasMessages = messages.length > 0 || loading;
  const last = messages.length > 0 ? messages[messages.length - 1] : null;
  const streaming = last?.role === "assistant" && !!last.content;

  return (
    <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
      <div className="mx-auto flex w-full min-w-0 flex-col gap-4 p-4">
        {!hasMessages && (
          <div className="mx-auto my-auto max-w-prose px-2 text-center text-muted-foreground">
            {emptyLabel}
          </div>
        )}

        {messages.map((m, i) => (
          <ChatBubble
            key={i}
            role={m.role}
            content={m.content}
            citations={m.citations}
            queryId={m.queryId}
            rating={m.rating}
            onRate={onRate}
            upLabel={upLabel}
            downLabel={downLabel}
            missingLabel={missingLabel}
            submitLabel={submitLabel}
            thanksLabel={thanksLabel}
          />
        ))}

        {loading && !streaming && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </span>
              {thinkingLabel}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
