"use client";

import {
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";
import { sendMessage, getOrCreateConversation } from "@/app/actions/agent";
import type { ChatMessage } from "@/lib/agent/types";

type AigentModalState = {
  open: (message: string) => void;
};

const AigentCtx = createContext<AigentModalState>({ open: () => {} });

export function useAigent() {
  return useContext(AigentCtx);
}

export function AigentModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [convoId, setConvoId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const ensureConvo = useCallback(async () => {
    if (convoId) return convoId;
    const c = await getOrCreateConversation();
    if (c) {
      setConvoId(c.id);
      return c.id;
    }
    return null;
  }, [convoId]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading) return;
      setInput("");

      const userMsg: ChatMessage = {
        role: "user",
        content: msg,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const cid = await ensureConvo();
        if (!cid) throw new Error("No conversation");
        const result = await sendMessage(cid, msg);
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: result.reply,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errMsg: ChatMessage = {
          role: "assistant",
          content: "Sorry, I had trouble processing that. Please try again.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, ensureConvo],
  );

  const openModal = useCallback(
    (message: string) => {
      setIsOpen(true);
      setMessages([]);
      setTimeout(() => handleSend(message), 100);
    },
    [handleSend],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AigentCtx.Provider value={{ open: openModal }}>
      {children}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 md:w-[480px]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#111827]">Buyers Aigent</p>
              <p className="text-xs text-[#9CA3AF]">AI property advisor</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div
                key={`${m.timestamp}-${i}`}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {m.role === "assistant" && (
                  <span className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white">
                    <Sparkles className="h-3 w-3" />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-[#0D9488] text-white"
                      : "bg-[#F3F4F6] text-[#111827]",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-headings:mb-2 prose-headings:mt-3 prose-headings:text-sm prose-headings:font-bold prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white">
                  <Sparkles className="h-3 w-3" />
                </span>
                <div className="rounded-2xl bg-[#F3F4F6] px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#9CA3AF] [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#9CA3AF] [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#9CA3AF] [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-[#E5E7EB] px-4 py-3">
          <div className="flex items-end gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up…"
              className="min-h-[40px] flex-1 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-base text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] md:text-sm"
            />
            <button
              type="button"
              disabled={!input.trim() || loading}
              onClick={() => handleSend()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D9488] text-white transition-colors hover:bg-[#0F766E] disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="mt-2 text-center">
            <Link
              href="/agent"
              onClick={() => setIsOpen(false)}
              className="text-xs text-[#9CA3AF] hover:text-[#0D9488]"
            >
              Open full Buyers Aigent →
            </Link>
          </div>
        </div>
      </div>
    </AigentCtx.Provider>
  );
}
