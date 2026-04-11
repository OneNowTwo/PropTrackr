"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { submitToWaitlist } from "@/app/actions/waitlist";

type Props = {
  source: string;
  variant?: "light" | "dark";
  className?: string;
};

export function WaitlistForm({
  source,
  variant = "light",
  className = "",
}: Props) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isDark = variant === "dark";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await submitToWaitlist(email, source);
      if (result.ok) {
        setSubmitted(true);
        setEmail("");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <p
        className={`text-sm font-medium ${isDark ? "text-center text-teal-300" : "text-[#0D9488]"} ${className}`}
        role="status"
      >
        You&apos;re on the list! We&apos;ll be in touch.
      </p>
    );
  }

  return (
    <div
      className={`${className} ${isDark ? "flex w-full max-w-lg flex-col items-center" : ""}`}
    >
      <p
        className={`w-full text-sm ${isDark ? "text-center text-gray-300" : "text-[#6B7280]"}`}
      >
        Get notified about new features and launch updates:
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:items-stretch"
      >
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className={`min-h-11 w-full flex-1 rounded-lg border px-3 py-2 text-sm outline-none ring-[#0D9488]/20 transition-shadow focus:ring-2 disabled:opacity-60 ${
            isDark
              ? "border-gray-600 bg-gray-800 text-white placeholder:text-gray-500"
              : "border-[#E5E7EB] bg-white text-[#111827] placeholder:text-[#9CA3AF]"
          }`}
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg bg-[#0D9488] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0F766E] disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <>
              Notify me
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </form>
      <p
        className={`mt-1.5 w-full text-xs ${isDark ? "text-center text-gray-500" : "text-[#9CA3AF]"}`}
      >
        No spam. Unsubscribe anytime.
      </p>
      {error ? (
        <p
          className={`mt-2 w-full text-sm text-red-500 ${isDark ? "text-center" : ""}`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
