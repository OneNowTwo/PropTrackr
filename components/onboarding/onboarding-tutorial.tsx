"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Home,
  MapPin,
  Puzzle,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export const PROPTRACKR_ONBOARDING_KEY = "proptrackr-onboarded";

const SHOW_TUTORIAL_EVENT = "proptrackr-show-tutorial";

const STEP_COUNT = 6;

export function dispatchOpenOnboardingTutorial() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROPTRACKR_ONBOARDING_KEY);
  window.dispatchEvent(new Event(SHOW_TUTORIAL_EVENT));
}

function IconCircle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#0D9488] text-white shadow-md shadow-[#0D9488]/25",
        className,
      )}
    >
      {children}
    </div>
  );
}

const STEPS = [
  {
    key: "welcome",
    eyebrow: "Welcome to PropTrackr",
    title: "Your AI-powered property buying companion",
    body: (
      <>
        <p>
          PropTrackr is everything you need to buy a home in Australia — in one
          place. From saving listings to settlement day, we&apos;ve got you
          covered.
        </p>
        <p className="mt-3 text-sm text-[#6B7280]">
          Built for Australian buyers searching in Sydney, Melbourne and
          Brisbane.
        </p>
      </>
    ),
    illustration: (
      <IconCircle>
        <Home className="h-9 w-9" strokeWidth={2} />
      </IconCircle>
    ),
    primaryCta: "start" as const,
  },
  {
    key: "save",
    eyebrow: "Save properties from anywhere",
    title: "One click. Any website.",
    body: (
      <>
        <p>
          Install the free Chrome extension and save any listing from
          realestate.com.au, domain.com.au, or any agency website instantly.
          Photos, price, agent details and inspection times are all
          auto-extracted by AI.
        </p>
        <p className="mt-3 text-sm text-[#6B7280]">
          Or paste any listing URL directly into PropTrackr — no extension
          needed.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-[#0D9488]/15 px-3 py-1 text-xs font-bold text-[#0F766E] ring-1 ring-[#0D9488]/30">
            REA
          </span>
          <span className="rounded-full bg-[#0D9488]/15 px-3 py-1 text-xs font-bold text-[#0F766E] ring-1 ring-[#0D9488]/30">
            Domain
          </span>
        </div>
      </>
    ),
    illustration: (
      <IconCircle>
        <Puzzle className="h-9 w-9" strokeWidth={2} />
      </IconCircle>
    ),
    primaryCta: "next" as const,
  },
  {
    key: "aigent",
    eyebrow: "Meet your Buyers Aigent",
    title: "Your personal AI buyers agent",
    body: (
      <>
        <p>
          The Buyers Aigent proactively guides you through every step of buying.
          Morning briefings, urgent action alerts, auction strategy, agent
          intelligence — without you having to ask.
        </p>
        <div className="mt-4 rounded-xl border border-[#0D9488]/25 bg-[#ECFDF5] px-4 py-3 text-left text-sm text-[#134E4A]">
          <strong className="font-semibold text-[#0F766E]">
            Unlike a chatbot, the Buyers Aigent talks first.
          </strong>{" "}
          It tells you what you need to know before you think to ask.
        </div>
      </>
    ),
    illustration: (
      <IconCircle className="animate-pulse">
        <Sparkles className="h-9 w-9" strokeWidth={2} />
      </IconCircle>
    ),
    primaryCta: "next" as const,
  },
  {
    key: "planner",
    eyebrow: "Plan your Saturdays",
    title: "Saturday sorted",
    body: (
      <>
        <p>
          Add your open home inspections and PropTrackr builds your optimised
          route with real drive times, estimated arrivals, and a recommended
          depart-by time.
        </p>
        <p className="mt-3 text-sm text-[#6B7280]">
          After each inspection, record voice notes, photos, and AI-generated
          checklists — all saved per property.
        </p>
      </>
    ),
    illustration: (
      <IconCircle>
        <div className="flex items-center gap-0.5">
          <CalendarDays className="h-7 w-7" strokeWidth={2} />
          <MapPin className="h-7 w-7" strokeWidth={2} />
        </div>
      </IconCircle>
    ),
    primaryCta: "next" as const,
  },
  {
    key: "suburbs",
    eyebrow: "Know your suburbs",
    title: "Research like a pro",
    body: (
      <>
        <p>
          Follow any suburb to see schools, cafes, restaurants, transport, and
          nearby sold properties on an interactive map. Hover over any place to
          see it on the map instantly.
        </p>
        <p className="mt-3 text-sm text-[#6B7280]">
          Track sale results yourself to build your own market intelligence — no
          subscription data needed.
        </p>
      </>
    ),
    illustration: (
      <IconCircle>
        <MapPin className="h-9 w-9" strokeWidth={2} />
      </IconCircle>
    ),
    primaryCta: "next" as const,
  },
  {
    key: "partner",
    eyebrow: "Search with your partner",
    title: "Buy together",
    body: (
      <>
        <p>
          Invite your partner to join your search. Share all saved properties,
          inspections, notes, Buyers Aigent conversations and suburb follows — in
          real time.
        </p>
        <p className="mt-3 text-sm text-[#6B7280]">
          Go to Account → Your search partner to send an invite.
        </p>
      </>
    ),
    illustration: (
      <IconCircle>
        <Users className="h-9 w-9" strokeWidth={2} />
      </IconCircle>
    ),
    primaryCta: "finish" as const,
  },
] as const;

export function OnboardingTutorial() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    localStorage.setItem(PROPTRACKR_ONBOARDING_KEY, "true");
    setOpen(false);
  }, []);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  useEffect(() => {
    setMounted(true);
    try {
      if (!localStorage.getItem(PROPTRACKR_ONBOARDING_KEY)) {
        setOpen(true);
        setStep(0);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    const onShow = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(SHOW_TUTORIAL_EVENT, onShow);
    return () => window.removeEventListener(SHOW_TUTORIAL_EVENT, onShow);
  }, []);

  if (!mounted || !open) return null;

  const progressPct = ((step + 1) / STEP_COUNT) * 100;
  const current = STEPS[step];

  const goNext = () => {
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const goBack = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#111827]/60 backdrop-blur-[2px] md:items-center md:justify-center md:bg-transparent md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <button
        type="button"
        className="hidden md:absolute md:inset-0 md:block md:bg-[#111827]/60 md:backdrop-blur-[2px]"
        aria-label="Close tutorial overlay"
        onClick={skip}
      />
      <div
        className={cn(
          "relative z-[101] flex min-h-0 w-full flex-1 flex-col overflow-hidden border-[#E5E7EB] bg-white shadow-xl md:max-h-[min(90vh,880px)] md:max-w-xl md:flex-none md:rounded-2xl md:border",
        )}
      >
        <div className="shrink-0 px-4 pt-4 md:px-6 md:pt-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
            <div
              className="h-full rounded-full bg-[#0D9488] transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs font-medium text-[#6B7280]">
            {step + 1} of {STEP_COUNT}
          </p>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{
              width: `${STEPS.length * 100}%`,
              transform: `translateX(-${(100 / STEPS.length) * step}%)`,
            }}
          >
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className="max-h-[calc(100dvh-200px)] shrink-0 overflow-y-auto px-4 pb-4 pt-4 md:max-h-[min(60vh,520px)] md:px-6 md:pb-6 md:pt-2"
                style={{ width: `${100 / STEPS.length}%` }}
                aria-hidden={i !== step}
              >
                <div className="mb-6 flex justify-center">{s.illustration}</div>
                <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-[#0D9488]">
                  {s.eyebrow}
                </p>
                <h2
                  id={i === step ? "onboarding-title" : undefined}
                  className="mt-2 text-center text-xl font-bold tracking-tight text-[#111827]"
                >
                  {s.title}
                </h2>
                <div className="mt-4 text-center text-sm leading-relaxed text-[#374151]">
                  {s.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] px-4 py-4 md:px-5">
          <button
            type="button"
            onClick={skip}
            className="text-left text-xs font-medium text-[#9CA3AF] transition-colors hover:text-[#6B7280]"
          >
            Skip tutorial
          </button>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#F9FAFB]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}
            {current.primaryCta === "start" ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0F766E]"
              >
                Let&apos;s get started
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : current.primaryCta === "finish" ? (
              <button
                type="button"
                onClick={finish}
                className="inline-flex items-center gap-1 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0F766E]"
              >
                Let&apos;s go!
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0F766E]"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
