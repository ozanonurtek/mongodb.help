import { useState } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type Citation = { title: string; url: string };

export function ChatBubble({
  role,
  content,
  citations,
  queryId,
  rating,
  onRate,
  upLabel,
  downLabel,
  missingLabel,
  submitLabel,
  thanksLabel,
}: {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  queryId?: string;
  rating?: number;
  onRate?: (queryId: string, rating: number, note?: string) => void;
  upLabel?: string;
  downLabel?: string;
  missingLabel?: string;
  submitLabel?: string;
  thanksLabel?: string;
}) {
  const isUser = role === "user";
  const [note, setNote] = useState("");
  const [noteSent, setNoteSent] = useState(false);
  const [sending, setSending] = useState(false);

  if (!isUser && !content.trim() && !queryId) return null;

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[85%] rounded-lg border border-border bg-card p-3 sm:p-4 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start">
      <div className="min-w-0 max-w-full text-base leading-relaxed break-words [overflow-wrap:anywhere] sm:max-w-prose">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="mt-4 mb-2 text-xl font-semibold text-primary">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-4 mb-2 text-lg font-semibold text-primary">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-3 mb-1 text-base font-medium text-primary">{children}</h3>
            ),
            p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
            ul: ({ children }) => (
              <ul
                className="my-2 max-w-full leading-relaxed"
                style={{ listStyleType: "disc", paddingLeft: "1.25rem" }}
              >
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol
                className="my-2 max-w-full leading-relaxed"
                style={{ listStyleType: "decimal", paddingLeft: "1.25rem" }}
              >
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li
                className="my-0.5"
                style={{ display: "list-item", marginLeft: "0.25rem" }}
              >
                {children}
              </li>
            ),
            code: ({ className, children, node, ...props }) => (
              <code
                className={cn(
                  "rounded bg-muted px-1 py-0.5 font-mono text-sm",
                  className,
                )}
                {...props}
              >
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="my-2 max-w-full overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-sm">
                {children}
              </pre>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-primary">{children}</strong>
            ),
          }}
        >
          {content}
        </ReactMarkdown>

        {citations && citations.length > 0 && (
          <ul className="mt-4 flex max-w-full flex-col gap-1 border-s-2 border-primary/30 ps-3 text-sm">
            {citations.map((c, j) => (
              <li key={j}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  [{j + 1}] {c.title}
                  <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {queryId && onRate && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNote("");
                  setNoteSent(false);
                  onRate(queryId, 1);
                }}
                aria-pressed={rating === 1}
                className={rating === 1 ? "border-primary text-primary" : ""}
              >
                {upLabel || "Helpful"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onRate(queryId, -1);
                }}
                aria-pressed={rating === -1}
                className={rating === -1 ? "border-primary text-primary" : ""}
              >
                {downLabel || "Not helpful"}
              </Button>
            </div>

            {rating === -1 && !noteSent && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!note.trim() || sending) return;
                  setSending(true);
                  try {
                    await onRate(queryId, -1, note.trim());
                    setNoteSent(true);
                  } finally {
                    setSending(false);
                  }
                }}
                className="flex items-start gap-2"
              >
                <textarea
                  className="min-h-9 flex-1 resize-y rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={missingLabel || "What was missing?"}
                  rows={1}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={sending}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!note.trim() || sending}
                >
                  {submitLabel || "Submit"}
                </Button>
              </form>
            )}

            {rating === -1 && noteSent && (
              <p className="text-xs text-muted-foreground">
                {thanksLabel || "Thanks, noted."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
