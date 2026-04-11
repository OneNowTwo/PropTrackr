"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Puzzle,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const PROPTRACKR_ONBOARDING_KEY = "proptrackr-onboarded";

const SHOW_TUTORIAL_EVENT = "proptrackr-show-tutorial";

export function dispatchOpenOnboardingTutorial() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROPTRACKR_ONBOARDING_KEY);
  window.dispatchEvent(new Event(SHOW_TUTORIAL_EVENT));
}

const STEPS = [
  {
    key: "save",
    title: "Save properties from anywhere",
    body: (
      <>
        <p>
          Browse realestate.com.au or domain.com.au, click the PropTrackr Chrome
          extension, and your listing is saved instantly with all details
          auto-extracted.
        </p>
        <p className="mt-3 text-sm text-[#6B7280]">
          Or paste any listing URL directly into PropTrackr.
        </p>
      </>
    ),
    illustration: (
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#0D9488]/15 text-[#0D9488] ring-2 ring-[#0D9488]/25">
          <Puzzle className="h-12 w-12" strokeWidth={1.75} />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-[#6B7280]">
          <span className="rounded-full bg-[#F3F4F6] px-3 py-1">Chrome extension</span>
          <span className="text-[#D1D5DB]">+</span>
          <span className="rounded-full bg-[#E0F2FE] px-3 py-1 text-[#0369A1]">
            REA
          </span>
          <span className="rounded-full bg-[#FEF3C7] px-3 py-1 text-[#B45309]">
            Domain
          </span>
        </div>
      </div>
    ),
  },
  {
    key: "aigent",
    title: "Your AI property advisor",
    body: (
      <p>
        The Buyers Aigent knows your entire search. It gives you morning
        briefings, flags urgent actions like booking building inspections, and
        guides you from first inspection to settlement.
      </p>
    ),
    illustration: (
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#0D9488]/15 text-[#0D9488] ring-2 ring-[#0D9488]/25">
        <Sparkles className="h-12 w-12" strokeWidth={1.75} />
      </div>
    ),
  },
  {
    key: "planner",
    title: "Saturday sorted",
    body: (
      <p>
        Add your open home inspections and PropTrackr builds your optimised
        route with drive times, arrival estimates, and a depart-by time.
      </p>
    ),
    illustration: (
      <div className="flex items-center justify-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0D9488]/15 text-[#0D9488] ring-2 ring-[#0D9488]/25">
          <CalendarDays className="h-10 w-10" strokeWidth={1.75} />
        </div>
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0D9488]/10 text-[#0D9488] ring-2 ring-[#0D9488]/20">
          <MapPin className="h-10 w-10" strokeWidth={1.75} />
        </div>
      </div>
    ),
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

  const isLast = step === STEPS.length - 1;
  const content = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#111827]/60 backdrop-blur-[2px]"
        aria-label="Close tutorial overlay"
        onClick={skip}
      />
      <div className="relative z-[101] w-full max-w-lg overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
        <div className="relative w-full overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{
              width: `${STEPS.length * 100}%`,
              transform: `translateX(-${(100 / STEPS.length) * step}%)`,
            }}
          >
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className="shrink-0 px-6 pb-6 pt-8"
                style={{ width: `${100 / STEPS.length}%` }}
                aria-hidden={i !== step}
              >
                <div className="mb-6 flex justify-center">{s.illustration}</div>
                <h2
                  id={i === step ? "onboarding-title" : undefined}
                  className="text-center text-xl font-bold tracking-tight text-[#111827]"
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

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-[#F3F4F6] px-5 py-4">
          <button
            type="button"
            onClick={skip}
            className="justify-self-start text-left text-xs font-medium text-[#9CA3AF] transition-colors hover:text-[#6B7280]"
          >
            Skip tutorial
          </button>
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === step ? "bg-[#0D9488]" : "bg-[#E5E7EB]"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#F9FAFB]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}
            {isLast ? (
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
                onClick={() => setStep((s) => s + 1)}
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
