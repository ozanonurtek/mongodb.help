import { useMemo } from "react";
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
  suggestedQuestions,
  onSuggestionClick,
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
  suggestedQuestions?: string[];
  onSuggestionClick?: (question: string) => void;
}) {
  const hasMessages = messages.length > 0 || loading;
  const last = messages.length > 0 ? messages[messages.length - 1] : null;
  const streaming = last?.role === "assistant" && !!last.content;

  // Pick 3 random suggestions once per mount (or when the pool changes —
  // e.g. on language switch). Reshuffling on every render would make the
  // chips jump as the user interacts.
  const picks = useMemo(() => {
    const pool = suggestedQuestions ?? [];
    if (pool.length <= 3) return pool;
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 3);
  }, [suggestedQuestions]);

  return (
    <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
      <div className="mx-auto flex w-full min-w-0 flex-col gap-4 p-4">
        {!hasMessages && (
          <div className="mx-auto my-auto flex max-w-prose flex-col items-center gap-4 px-2 text-center">
            <p className="text-muted-foreground">{emptyLabel}</p>
            {picks.length > 0 && onSuggestionClick && (
              <div className="flex w-full flex-col gap-2">
                {picks.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onSuggestionClick(q)}
                    className="rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
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
