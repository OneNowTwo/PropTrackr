import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  GitCompareArrows,
  Link2,
  Mic,
  Quote,
  Users,
  FolderOpen,
} from "lucide-react";

import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "PropTrackr — Your home search, finally organised",
  description:
    "Save listings, plan inspections, compare properties and track every agent — built for serious Australian property buyers.",
};

const painPoints = [
  "15 browser tabs open, screenshots everywhere, notes in your phone",
  "Can't remember which agent said what about which property",
  "Missed an open home because your calendar was a mess",
];

const featureTiles = [
  {
    title: "Save any listing",
    description:
      "Paste a URL — we extract address, price, photos and details automatically.",
    icon: Link2,
  },
  {
    title: "Inspection planner",
    description:
      "Schedule open homes in one place so you never miss a viewing.",
    icon: CalendarDays,
  },
  {
    title: "AI comparison",
    description:
      "Compare two properties side by side and get a clear, practical verdict.",
    icon: GitCompareArrows,
  },
  {
    title: "Agent tracker",
    description:
      "Every agent, their listings, and your checklist — all linked up.",
    icon: Users,
  },
  {
    title: "Voice notes",
    description:
      "Record impressions at inspections; AI summarises what mattered.",
    icon: Mic,
  },
  {
    title: "Documents",
    description:
      "Contracts, pest reports and PDFs filed under the right property.",
    icon: FolderOpen,
  },
];

const steps = [
  {
    n: "1",
    title: "Paste a listing URL",
    body: "Details auto-fill instantly — less typing, fewer mistakes.",
  },
  {
    n: "2",
    title: "Plan your inspections",
    body: "Your calendar keeps you on track for every open home.",
  },
  {
    n: "3",
    title: "Compare and decide",
    body: "AI helps you weigh options so you can move with confidence.",
  },
];

const testimonials = [
  {
    quote:
      "Finally one place for every listing. We shortlisted faster and actually enjoyed the search.",
    name: "Sarah M.",
    location: "Sydney, NSW",
  },
  {
    quote:
      "The inspection planner alone saved us — no more double-booked Saturdays.",
    name: "James T.",
    location: "Melbourne, VIC",
  },
  {
    quote:
      "Voice notes after each open home mean I don't forget the little things that matter.",
    name: "Priya K.",
    location: "Brisbane, QLD",
  },
];

export default function LandingPage() {
  return (
    <div
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#F8F9FA] text-[#111827]"
      style={{ backgroundColor: "#F8F9FA" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 85% 55% at 50% -15%, rgba(13, 148, 136, 0.12), transparent 50%)",
        }}
      />

      <header className="relative z-20 border-b border-[#E5E7EB] bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/landing"
            className="flex items-center gap-2.5 font-semibold tracking-tight text-[#111827]"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]"
              aria-hidden
            >
              <Building2 className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="text-lg">PropTrackr</span>
          </Link>
          <nav
            className="flex items-center gap-2 sm:gap-3"
            aria-label="Marketing"
          >
            <Button
              variant="ghost"
              className="hidden text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827] sm:inline-flex"
              asChild
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button
              className="bg-[#0D9488] px-3 font-medium text-white shadow-sm hover:bg-[#0D9488]/90 sm:px-4"
              asChild
            >
              <Link href="/sign-up">Start free</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pb-24 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 text-center lg:order-1 lg:text-left">
              <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-[#111827] sm:text-5xl lg:text-[3.25rem]">
                Your home search,{" "}
                <span className="text-[#0D9488]">finally organised</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[#6B7280] lg:mx-0">
                Save listings, plan inspections, compare properties and track
                every agent — all in one place. Built for serious Australian
                property buyers.
              </p>
              <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
                <Button
                  size="lg"
                  className="h-12 min-w-[180px] bg-[#0D9488] text-base font-semibold text-white shadow-md shadow-[#0D9488]/20 hover:bg-[#0D9488]/90"
                  asChild
                >
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center justify-center gap-2"
                  >
                    Start free
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 min-w-[180px] border-[#E5E7EB] bg-white text-base font-medium text-[#111827] hover:bg-[#F8F9FA]"
                  asChild
                >
                  <Link href="#features">See how it works</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-[#6B7280]">
                No credit card required to start · Works with major Australian
                listing sites
              </p>
            </div>
            <div className="order-1 mx-auto w-full max-w-lg lg:order-2 lg:max-w-none">
              <DashboardMockup className="w-full" />
            </div>
          </div>
        </section>

        {/* Pain points */}
        <section className="border-t border-[#E5E7EB] bg-white py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Sound familiar?
            </h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-6">
              {painPoints.map((text) => (
                <li
                  key={text}
                  className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-6 shadow-sm"
                  style={{ backgroundColor: "#F8F9FA" }}
                >
                  <p className="text-sm font-medium leading-relaxed text-[#374151] sm:text-base">
                    {text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="scroll-mt-20 border-t border-[#E5E7EB] py-14 lg:py-20"
          style={{ backgroundColor: "#F8F9FA" }}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D9488]">
                Features
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
                Everything serious buyers need
              </h2>
              <p className="mt-3 text-[#6B7280]">
                One workspace from first inspection to final offer.
              </p>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {featureTiles.map(({ title, description, icon: Icon }) => (
                <li
                  key={title}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md lg:p-8"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                    <Icon className="h-6 w-6" strokeWidth={2} />
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

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-t border-[#E5E7EB] bg-white py-14 lg:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
                How it works
              </h2>
              <p className="mt-3 text-[#6B7280]">
                Three steps from chaos to clarity.
              </p>
            </div>
            <ol className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-3 md:gap-6">
              {steps.map((s) => (
                <li
                  key={s.n}
                  className="relative flex flex-col rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-6 text-center md:text-left"
                  style={{ backgroundColor: "#F8F9FA" }}
                >
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#0D9488] text-lg font-bold text-white md:mx-0">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-[#111827]">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="scroll-mt-20 border-t border-[#E5E7EB] py-14 lg:py-20"
          style={{ backgroundColor: "#F8F9FA" }}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
                Simple pricing
              </h2>
              <p className="mt-3 text-[#6B7280]">
                Start free. Upgrade when you need AI and unlimited properties.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-4xl gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#6B7280]">
                  Free
                </p>
                <p className="mt-2 text-4xl font-semibold text-[#111827]">
                  $0
                  <span className="text-lg font-normal text-[#6B7280]">
                    /month
                  </span>
                </p>
                <ul className="mt-8 flex-1 space-y-3 text-sm text-[#374151]">
                  {[
                    "Save up to 5 properties",
                    "Inspection planner",
                    "Basic notes",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]"
                        strokeWidth={2.5}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="mt-8 h-11 border-[#E5E7EB] bg-white font-medium"
                  asChild
                >
                  <Link href="/sign-up?plan=free">Get started</Link>
                </Button>
              </div>

              <div className="relative flex flex-col rounded-2xl border-2 border-[#0D9488] bg-white p-8 shadow-lg shadow-[#0D9488]/10 ring-1 ring-[#0D9488]/15">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0D9488] px-3 py-0.5 text-xs font-semibold text-white">
                  Most popular
                </span>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#0D9488]">
                  Pro
                </p>
                <p className="mt-2 text-4xl font-semibold text-[#111827]">
                  $19
                  <span className="text-lg font-normal text-[#6B7280]">
                    /month
                  </span>
                </p>
                <ul className="mt-8 flex-1 space-y-3 text-sm text-[#374151]">
                  {[
                    "Unlimited properties",
                    "AI property comparison",
                    "Voice notes with AI summary",
                    "Agent tracker",
                    "Document storage",
                    "Priority support",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]"
                        strokeWidth={2.5}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 h-11 bg-[#0D9488] font-semibold text-white hover:bg-[#0D9488]/90"
                  asChild
                >
                  <Link href="/sign-up?plan=pro">Start free trial</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="border-t border-[#E5E7EB] bg-white py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Join buyers making smarter property decisions
            </h2>
            <ul className="mt-10 grid gap-6 md:grid-cols-3">
              {testimonials.map((t) => (
                <li
                  key={t.name}
                  className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-6"
                  style={{ backgroundColor: "#F8F9FA" }}
                >
                  <Quote
                    className="h-8 w-8 text-[#0D9488]/40"
                    aria-hidden
                    strokeWidth={1.5}
                  />
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-[#374151]">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="mt-4 text-sm font-semibold text-[#111827]">
                    {t.name}
                  </p>
                  <p className="text-xs text-[#6B7280]">{t.location}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <Link href="/landing" className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
                  <Building2 className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="text-lg font-semibold text-[#111827]">
                  PropTrackr
                </span>
              </Link>
              <p className="mt-3 max-w-xs text-sm text-[#6B7280]">
                The property buyer dashboard for Australian home buyers.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <Link
                href="#features"
                className="text-[#6B7280] transition-colors hover:text-[#0D9488]"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="text-[#6B7280] transition-colors hover:text-[#0D9488]"
              >
                Pricing
              </Link>
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
                Sign up
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-[#E5E7EB] py-4 text-center text-xs text-[#6B7280]">
          © {new Date().getFullYear()} PropTrackr. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
