"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, X } from "lucide-react";
import { useAdminBrandColor } from "@/components/admin/admin-brand-context";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string; toolsUsed?: string[] };

const SUGGESTIONS = [
  "How is my business doing today?",
  "What are my top sellers this week?",
  "When are my peak hours?",
  "How is inventory looking?",
  "Who are my best-performing staff?",
];

export function BusinessChatbot({
  slug,
  restaurantName,
  canUse,
}: {
  slug: string;
  restaurantName: string;
  canUse: boolean;
}) {
  const brand = useAdminBrandColor();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages, busy]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    if (!canUse) return;

    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/admin/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = (await res.json()) as {
        reply?: string;
        toolsUsed?: { name: string }[];
        error?: string;
        gated?: boolean;
      };

      if (!res.ok) {
        if (json.gated || json.error === "Galeyr 1.0 exclusive") {
          setError("Galeyr 1.0 exclusive");
        } else {
          setError(json.error || "Could not get an answer");
        }
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.reply || "—",
          toolsUsed: (json.toolsUsed ?? []).map((t) => t.name),
        },
      ]);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close business assistant" : "Open business assistant"}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:bottom-6 md:right-6"
        style={{ backgroundColor: brand }}
      >
        {open ? (
          <X className="h-7 w-7" strokeWidth={2.25} />
        ) : (
          <Bot className="h-8 w-8" strokeWidth={2.25} aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div
          className="fixed bottom-[5.5rem] right-4 z-50 flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] shadow-xl md:bottom-24 md:right-6"
          style={{ maxHeight: "min(70vh, 34rem)" }}
          role="dialog"
          aria-label="Business assistant"
        >
          <div
            className="flex items-center gap-2 px-4 py-3 text-white"
            style={{ backgroundColor: brand }}
          >
            <Bot className="h-5 w-5 shrink-0 opacity-90" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Ask Hilaac</p>
              <p className="truncate text-xs opacity-90">{restaurantName}</p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 hover:bg-white/15"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {!canUse ? (
              <div className="space-y-2 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
                  Galeyr 1.0 exclusive
                </p>
                <p className="text-sm text-[var(--admin-muted,#64748B)]">
                  The AI Business Chatbot is available on Galeyr 1.0. Upgrade to ask about sales,
                  profit, inventory, staff, and customers.
                </p>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                  {messages.length === 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-[var(--admin-muted,#64748B)]">
                        Ask about your business. Answers come only from your live data.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS.map((q) => (
                          <button
                            key={q}
                            type="button"
                            disabled={busy}
                            onClick={() => void send(q)}
                            className="rounded-full border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-bg,#F8FAFC)] px-3 py-1.5 text-left text-xs text-[var(--admin-text,#0F172A)] transition hover:border-[var(--admin-brand)]"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {messages.map((m, i) => (
                    <div
                      key={`${m.role}-${i}`}
                      className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                          m.role === "user"
                            ? "text-white"
                            : "bg-muted text-foreground"
                        )}
                        style={m.role === "user" ? { backgroundColor: brand } : undefined}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        {m.toolsUsed && m.toolsUsed.length > 0 ? (
                          <p className="mt-1.5 text-[10px] opacity-70">
                            Looked up: {Array.from(new Set(m.toolsUsed)).join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}

                  {busy ? (
                    <div className="flex items-center gap-2 text-xs text-[var(--admin-muted,#64748B)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Checking your data…
                    </div>
                  ) : null}
                  {error ? <p className="text-xs text-destructive">{error}</p> : null}
                  <div ref={bottomRef} />
                </div>

                {messages.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 border-t border-[var(--admin-border,#E2E8F0)] px-3 py-2">
                    {SUGGESTIONS.slice(0, 3).map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={busy}
                        onClick={() => void send(q)}
                        className="rounded-full border border-[var(--admin-border,#E2E8F0)] px-2.5 py-1 text-[11px] text-[var(--admin-muted,#64748B)] hover:text-[var(--admin-text,#0F172A)]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                ) : null}

                <form
                  className="flex items-center gap-2 border-t border-[var(--admin-border,#E2E8F0)] p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about sales, stock, staff…"
                    disabled={busy}
                    className="min-w-0 flex-1 rounded-xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-3 py-2 text-sm text-[var(--admin-text,#0F172A)] outline-none placeholder:text-[var(--admin-muted,#64748B)] focus:ring-2 focus:ring-[var(--admin-brand)]"
                  />
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    aria-label="Send"
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white disabled:opacity-50"
                    style={{ backgroundColor: brand }}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
