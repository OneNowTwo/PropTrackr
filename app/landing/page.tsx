import Link from "next/link";
import { ArrowRight, GitCompareArrows, ListChecks, Sparkles } from "lucide-react";

import { HeroIllustration } from "@/components/landing/hero-illustration";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Save listings",
    description:
      "Capture every address, price, and link in one workspace so nothing slips through while you search.",
    icon: ListChecks,
  },
  {
    title: "Plan inspections",
    description:
      "Keep open homes and private viewings organised alongside each property — ready when you connect your calendar.",
    icon: Sparkles,
  },
  {
    title: "Compare properties",
    description:
      "Stack shortlisted homes side by side with clear facts and notes so the right decision feels obvious.",
    icon: GitCompareArrows,
  },
];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#F8F9FA] text-[#111827]">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -20%, rgba(13, 148, 136, 0.14), transparent 55%)",
        }}
      />

      <header className="relative z-10 border-b border-[#E5E7EB] bg-white/90 px-6 py-4 backdrop-blur-md lg:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-[#111827]">
            PropTrackr
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              className="text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]"
              asChild
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button
              className="bg-[#0D9488] font-medium text-white shadow-sm hover:bg-[#0D9488]/90"
              asChild
            >
              <Link href="/sign-up">Start free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-14 lg:grid-cols-2 lg:items-center lg:gap-20 lg:pb-28 lg:pt-20">
          <div className="text-center lg:text-left">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#0D9488]">
              Built for Australian buyers
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-[#111827] sm:text-5xl lg:text-[3.25rem]">
              Your home search,{" "}
              <span className="text-[#0D9488]">calm and under control</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[#6B7280] lg:mx-0">
              Save listings from any site, autofill details from the URL, and
              keep notes and comparisons in one professional workspace — free
              to start.
            </p>
            <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
              <Button
                size="lg"
                className="h-12 min-w-[200px] bg-[#0D9488] text-base font-semibold text-white shadow-md shadow-[#0D9488]/20 hover:bg-[#0D9488]/90"
                asChild
              >
                <Link href="/sign-up" className="gap-2">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-[#E5E7EB] bg-white text-base font-medium text-[#111827] hover:bg-[#F8F9FA]"
                asChild
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-[#6B7280]">
              No credit card required · Works with Domain, REA, and agent sites
            </p>
          </div>
          <div className="mx-auto w-full max-w-md lg:max-w-none lg:justify-self-end">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm lg:p-6">
              <HeroIllustration className="h-auto w-full" />
            </div>
          </div>
        </section>

        <section className="border-t border-[#E5E7EB] bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
                Everything you need to decide with confidence
              </h2>
              <p className="mt-3 text-[#6B7280]">
                Three ways PropTrackr keeps your search structured from first
                click to final offer.
              </p>
            </div>
            <ul className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-10">
              {features.map(({ title, description, icon: Icon }) => (
                <li
                  key={title}
                  className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-8 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#111827]">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                    {description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#E5E7EB] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#111827]">PropTrackr</p>
            <p className="mt-1 max-w-sm text-sm text-[#6B7280]">
              A calm workspace for serious property buyers in Australia.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <Link
              href="/sign-in"
              className="text-[#6B7280] transition-colors hover:text-[#0D9488]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-[#6B7280] transition-colors hover:text-[#0D9488]"
            >
              Create account
            </Link>
          </div>
        </div>
        <div className="border-t border-[#E5E7EB] py-4 text-center text-xs text-[#6B7280]">
          © {new Date().getFullYear()} PropTrackr. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
