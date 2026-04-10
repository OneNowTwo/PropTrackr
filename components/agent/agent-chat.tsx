"use client";

import {
  Building2,
  CalendarDays,
  ChevronRight,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";
import {
  generateDailyBriefing,
  sendMessage,
} from "@/app/actions/agent";
import type { ChatMessage } from "@/lib/agent/types";

type Props = {
  conversationId: string;
  initialMessages: ChatMessage[];
  stats: {
    propertyCount: number;
    nextInspection: string | null;
    nextAuction: string | null;
    unreadInsights: number;
  };
};

const QUICK_ACTIONS = [
  { label: "Analyse my search", message: "Analyse my property search — what am I doing well, what should I change?" },
  { label: "Draft agent email", message: "Help me draft an email to a real estate agent" },
  { label: "Auction strategy", message: "What auction strategy do you recommend for my shortlisted properties?" },
  { label: "What should I do next?", message: "What should I do next in my property search?" },
  { label: "Finance checklist", message: "Give me a finance and pre-approval checklist for buying" },
] as const;

export function AgentChat({ conversationId, initialMessages, stats }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const briefingFetched = useRef(false);

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

  useEffect(() => {
    if (briefingFetched.current) return;
    if (messages.length > 0) return;
    briefingFetched.current = true;

    setBriefingLoading(true);
    generateDailyBriefing()
      .then((result) => {
        if (result?.briefing) {
          const msg: ChatMessage = {
            role: "assistant",
            content: result.briefing,
            timestamp: new Date().toISOString(),
          };
          setMessages([msg]);
          setSuggestedReplies(result.suggestedReplies);
        }
      })
      .catch(console.error)
      .finally(() => setBriefingLoading(false));
  }, [messages.length]);

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
      setSuggestedReplies([]);
      setLoading(true);

      try {
        const result = await sendMessage(conversationId, msg);
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: result.reply,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setSuggestedReplies(result.suggestedReplies);
      } catch (e) {
        const errorMsg: ChatMessage = {
          role: "assistant",
          content:
            "Sorry, I had trouble processing that. Please try again.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [conversationId, input, loading],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col md:flex-row md:gap-6">
      {/* ── Left sidebar (desktop) / top strip (mobile) ── */}
      <aside className="shrink-0 md:w-72">
        {/* Summary card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488] text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-[#111827]">
              Your search
            </h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Properties</span>
              <span className="font-semibold text-[#111827]">
                {stats.propertyCount}
              </span>
            </div>
            {stats.nextInspection && (
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]">Next inspection</span>
                <span className="max-w-[120px] truncate text-xs font-medium text-[#0D9488]">
                  {stats.nextInspection}
                </span>
              </div>
            )}
            {stats.nextAuction && (
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]">Next auction</span>
                <span className="max-w-[120px] truncate text-xs font-medium text-red-600">
                  {stats.nextAuction}
                </span>
              </div>
            )}
            {stats.unreadInsights > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]">Unread insights</span>
                <span className="rounded-full bg-[#0D9488]/10 px-2 py-0.5 text-xs font-bold text-[#0D9488]">
                  {stats.unreadInsights}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-1 border-t border-[#F3F4F6] pt-3">
            <Link
              href="/properties"
              className="flex flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]"
            >
              <Building2 className="h-3.5 w-3.5" /> Properties
            </Link>
            <Link
              href="/planner"
              className="flex flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]"
            >
              <CalendarDays className="h-3.5 w-3.5" /> Planner
            </Link>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 hidden space-y-1.5 md:block">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
            Quick actions
          </p>
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={loading}
              onClick={() => handleSend(a.message)}
              className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              <span className="flex-1">{a.label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-[#D1D5DB] opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </aside>

      {/* ── Chat panel ── */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm md:mt-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-sm font-bold text-[#111827]">
              PropTrackr AI Agent
            </h1>
            <p className="text-xs text-[#9CA3AF]">
              Your personal buyers agent
            </p>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {briefingLoading && messages.length === 0 && (
            <div className="flex items-center gap-3 py-8 text-[#9CA3AF]">
              <Loader2 className="h-5 w-5 animate-spin text-[#0D9488]" />
              <span className="text-sm">
                Preparing your daily briefing…
              </span>
            </div>
          )}

          {!briefingLoading && messages.length === 0 && (
            <div className="py-12 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-[#0D9488]/30" />
              <p className="mt-3 text-sm font-medium text-[#6B7280]">
                Your AI buyers agent is ready
              </p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                Ask anything about your property search
              </p>
            </div>
          )}

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
                  <span className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[75%]",
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
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white">
                  <Sparkles className="h-3.5 w-3.5" />
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

          {/* Suggested replies */}
          {suggestedReplies.length > 0 && !loading && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedReplies.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] transition-colors hover:border-[#0D9488] hover:text-[#0D9488]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[#E5E7EB] px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your buyers agent anything…"
              rows={1}
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-base text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] md:text-sm"
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
        </div>
      </div>
    </div>
  );
}
