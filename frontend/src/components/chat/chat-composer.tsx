import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

export function ChatComposer({
  value,
  onChange,
  onSend,
  loading,
  placeholder,
  sendLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  placeholder: string;
  sendLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Modern browsers auto-size via `field-sizing: content` (globals.css),
  // which also sizes to the wrapped placeholder so it never clips. Only
  // fall back to JS growth where that property is unsupported — setting an
  // inline height on supporting browsers would fight the native sizing.
  const jsGrow =
    typeof CSS === "undefined" || !CSS.supports("field-sizing", "content");

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  useEffect(() => {
    if (jsGrow && ref.current) autoGrow(ref.current);
  }, [jsGrow, value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="border-t border-border bg-card px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:pb-3">
      {/* items-stretch (flex default): the send button always matches the
          input's rendered height — one line or five, they stay aligned. */}
      <div className="mx-auto flex w-full gap-2">
        <Textarea
          ref={ref}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="max-h-40 min-h-10 flex-1 resize-none text-sm"
          rows={1}
        />
        <Button
          onClick={onSend}
          disabled={loading || !value.trim()}
          className="h-auto self-stretch shrink-0"
          aria-label={sendLabel}
        >
          <Send className="size-4" />
          <span className="hidden sm:inline">{sendLabel}</span>
        </Button>
      </div>
    </div>
  );
}
