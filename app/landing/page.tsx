import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  Check,
  MapPin,
  Puzzle,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "PropTrackr — Your AI property buying companion",
  description:
    "AI-powered property buying companion for Australian home buyers. Buyers Aigent, Chrome extension, smart planner, suburb intel, and more — from first inspection to settlement.",
};

const painPoints = [
  {
    title: "6-9 months of searching",
    body: "Domain research shows buyers spend an average of 6-9 months searching, attending dozens of open homes and losing auctions before finding the right property.",
  },
  {
    title: "Information overload",
    body: "REA and Domain show you listings. They don't help you track, compare, research or decide. You're left with spreadsheets, notes apps and memory.",
  },
  {
    title: "Flying blind at auctions",
    body: "94% of buyers experience significant stress during the process. Most have no strategy, no preparation, and no one in their corner.",
  },
];

const bigSix = [
  {
    icon: Sparkles,
    title: "Your AI buyers agent",
    badge: "NEW",
    description:
      "Proactive advice without being asked. Auction strategy, inspection prep, agent intelligence, finance reminders — the Buyers Aigent knows your search inside out and tells you what to do next.",
  },
  {
    icon: Puzzle,
    title: "Save any listing in one click",
    description:
      "Browse REA, Domain, or any agency site. Click the PropTrackr extension and the listing is saved instantly — photos, price, agent details, inspection times, all auto-extracted.",
  },
  {
    icon: CalendarDays,
    title: "Saturday sorted",
    description:
      "Your open home route, optimised for time and traffic. See drive times between each stop, estimated arrival times, and your depart-by time — all in one view.",
  },
  {
    icon: MapPin,
    title: "Know the suburb, not just the house",
    description:
      "Schools, cafes, transport, crime rates, price history, recently sold properties on a map. Everything you need to know about where you're buying.",
  },
  {
    icon: Users,
    title: "Know who you're dealing with",
    description:
      "Track every agent across your search. See which properties they're selling, add performance notes, and get AI insights on how to negotiate with them.",
  },
  {
    icon: Camera,
    title: "Capture everything at inspections",
    description:
      "Voice notes transcribed by AI into pros, cons and questions. Photos uploaded instantly. Inspection checklists. Everything in one place per property.",
  },
];

const howSteps = [
  {
    title: "Save properties from anywhere",
    body: "Browse REA or Domain, click the Chrome extension. PropTrackr saves the listing with all details automatically extracted.",
  },
  {
    title: "Your Buyers Aigent gets to work",
    body: "Instantly analyse each property, flag urgent actions, prepare you for inspections, and guide you through due diligence.",
  },
  {
    title: "Buy with confidence",
    body: "Attend inspections with AI-prepared checklists, get auction strategy tailored to your properties, and track every step to settlement.",
  },
];

const aigentCaps = [
  {
    title: "Morning briefings",
    body: "Wake up to a daily briefing on your search. Urgent actions, upcoming inspections, market insights.",
  },
  {
    title: "Auction strategy",
    body: "Get tailored auction strategy for each property. Know your limit, know the agent, know when to walk away.",
  },
  {
    title: "Draft agent emails",
    body: "Ask the Aigent to draft any email to any agent. Negotiation, follow-up, requesting documents — done in seconds.",
  },
  {
    title: "Due diligence guide",
    body: "Never miss a step. Building inspections, strata reports, contract review, finance confirmation — tracked and guided.",
  },
];

const testimonials = [
  {
    quote:
      "I had 3 properties shortlisted and an auction in 8 days. The Buyers Aigent told me exactly what to do and when. I felt prepared for the first time in months.",
    name: "Sarah T.",
    location: "bought in Mosman",
  },
  {
    quote:
      "The Chrome extension alone saves me 30 minutes per property. One click and everything is saved. I don't know how I searched without it.",
    name: "James K.",
    location: "searching in Melbourne",
  },
  {
    quote:
      "Finally something built for the buyer, not the agent. PropTrackr is the unfair advantage I didn't know I needed.",
    name: "Michael R.",
    location: "bought in Brisbane",
  },
];

const faqs = [
  {
    q: "Does it work with REA and Domain?",
    a: "Yes. The Chrome extension works with realestate.com.au, domain.com.au, and hundreds of agency websites across Australia.",
  },
  {
    q: "What is the Buyers Aigent?",
    a: "The Buyers Aigent is an AI advisor built specifically for Australian property buyers. It proactively guides you through every step — from saving your first property to settlement day. Unlike a chatbot, it talks first and tells you what you need to know without being asked.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your property data, notes, and search information are private to your account and never shared with agents, portals, or third parties.",
  },
  {
    q: "Do I need the Chrome extension?",
    a: "No, but it makes saving properties much faster. You can also add properties by pasting a listing URL directly into PropTrackr.",
  },
  {
    q: "Can my partner use it too?",
    a: "Yes. PropTrackr has couples/partner mode — invite your partner and share your entire search including saved properties, inspections, notes and Buyers Aigent conversations.",
  },
  {
    q: "Is there a free trial?",
    a: "The free plan lets you save up to 5 properties with no time limit. Pro features include a 14-day free trial, no credit card required.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-white text-[#111827]">
      <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link
            href="/landing"
            className="flex items-center gap-2 font-semibold tracking-tight text-[#111827]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
              <Building2 className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <span className="text-lg">PropTrackr</span>
          </Link>
          <nav
            className="flex items-center gap-2 sm:gap-3"
            aria-label="Marketing"
          >
            <Button
              variant="ghost"
              size="sm"
              className="hidden text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827] sm:inline-flex"
              asChild
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button
              size="sm"
              className="bg-[#0D9488] px-3 font-medium text-white hover:bg-[#0F766E] sm:px-4"
              asChild
            >
              <Link href="/sign-up">Start for free</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14 lg:gap-x-16">
            <div className="order-2 text-center lg:order-1 lg:text-left">
              <h1 className="text-balance text-3xl font-semibold leading-[1.12] tracking-tight text-[#111827] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                Your personal AI buyers agent.
                <br />
                <span className="text-[#0D9488]">Without the $15,000 fee.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-[#6B7280] sm:text-lg lg:mx-0">
                PropTrackr guides you through every step of buying a home in
                Australia — from first inspection to settlement. Powered by AI,
                built for real buyers.
              </p>
              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
                <Button
                  size="lg"
                  className="h-12 bg-[#0D9488] text-base font-semibold text-white hover:bg-[#0F766E]"
                  asChild
                >
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center justify-center gap-2"
                  >
                    Start for free
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-[#E5E7EB] bg-white text-base font-medium text-[#111827] hover:bg-[#F9FAFB]"
                  asChild
                >
                  <Link href="#features">See how it works</Link>
                </Button>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div
                className="mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-2xl border border-[#0D9488]/20 bg-gradient-to-br from-[#0D9488] to-[#0F766E] shadow-lg shadow-[#0D9488]/15 lg:max-w-none"
                aria-label="Buyers Aigent command centre preview"
              >
                <div className="flex h-full flex-col p-6 text-white sm:p-8">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6 shrink-0" aria-hidden />
                    <span className="text-sm font-semibold tracking-wide opacity-95">
                      Buyers Aigent
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-medium leading-snug opacity-95 sm:text-xl">
                    Your command centre
                  </p>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/85">
                    Urgent actions, pipeline, inspections, agent intel — one
                    place. (Product preview)
                  </p>
                  <div className="mt-auto space-y-2 rounded-xl bg-white/10 p-3 text-xs text-white/90 backdrop-blur-sm">
                    <div className="h-2 w-3/4 rounded-full bg-white/25" />
                    <div className="h-2 w-1/2 rounded-full bg-white/20" />
                    <div className="h-2 w-5/6 rounded-full bg-white/15" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-10 text-center text-sm text-[#6B7280] sm:mt-12">
            Built for Australian buyers · Sydney · Melbourne · Brisbane · All
            major portals supported
          </p>
        </section>

        {/* Pain points */}
        <section className="border-t border-[#E5E7EB] bg-[#FAFAFA] py-14 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="mx-auto max-w-3xl text-center text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Buying a home in Australia is harder than it should be
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-3 sm:gap-6">
              {painPoints.map((p) => (
                <li
                  key={p.title}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm"
                >
                  <h3 className="text-base font-semibold text-[#111827]">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
                    {p.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features — Big 6 */}
        <section
          id="features"
          className="scroll-mt-20 border-t border-[#E5E7EB] py-14 sm:py-16 lg:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Everything you need to buy with confidence
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {bigSix.map(({ icon: Icon, title, description, badge }) => (
                <li
                  key={title}
                  className="relative rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm lg:p-7"
                >
                  {badge ? (
                    <span className="absolute right-4 top-4 rounded-full bg-[#0D9488] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {badge}
                    </span>
                  ) : null}
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#111827]">
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
        <section className="border-t border-[#E5E7EB] bg-[#FAFAFA] py-14 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              From listing to settlement, we&apos;ve got you
            </h2>
            <ol className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3 md:gap-8">
              {howSteps.map((s, i) => (
                <li
                  key={s.title}
                  className="relative rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0D9488] text-sm font-bold text-white">
                    {i + 1}
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

        {/* Buyers Aigent spotlight */}
        <section className="border-t border-[#E5E7EB] bg-[#0F766E] py-14 text-white sm:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Meet your Buyers Aigent
              </h2>
              <p className="mt-3 text-base text-white/90 sm:text-lg">
                The first AI built specifically for Australian property buyers
              </p>
            </div>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {aigentCaps.map((c) => (
                <li
                  key={c.title}
                  className="rounded-2xl bg-white p-5 text-[#0F766E] shadow-md"
                >
                  <h3 className="font-semibold text-[#0D9488]">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#374151]">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-10 text-center">
              <Button
                className="bg-white font-semibold text-[#0F766E] hover:bg-white/90"
                asChild
              >
                <Link href="/sign-up" className="inline-flex items-center gap-2">
                  Try Buyers Aigent
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </p>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-[#E5E7EB] py-14 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              What buyers say
            </h2>
            <ul className="mt-10 grid gap-6 md:grid-cols-3">
              {testimonials.map((t) => (
                <li
                  key={t.name}
                  className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-6"
                >
                  <p className="flex-1 text-sm leading-relaxed text-[#374151]">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="mt-4 text-sm font-semibold text-[#111827]">
                    — {t.name}
                  </p>
                  <p className="text-xs text-[#6B7280]">{t.location}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="scroll-mt-20 border-t border-[#E5E7EB] bg-[#FAFAFA] py-14 sm:py-16 lg:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Simple pricing. No surprises.
            </h2>
            <div className="mx-auto mt-10 grid max-w-4xl gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#6B7280]">
                  Free
                </p>
                <p className="mt-2 text-4xl font-semibold text-[#111827]">
                  $0
                </p>
                <ul className="mt-8 flex-1 space-y-3 text-sm text-[#374151]">
                  {[
                    "Save up to 5 properties",
                    "Basic planner",
                    "Chrome extension",
                    "Suburb overview",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="mt-8 h-11 border-[#E5E7EB] font-medium"
                  asChild
                >
                  <Link href="/sign-up">Get started free</Link>
                </Button>
              </div>

              <div className="relative flex flex-col rounded-2xl border-2 border-[#0D9488] bg-white p-8 shadow-md">
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
                    "Buyers Aigent (AI advisor)",
                    "Morning briefings",
                    "Auction strategy",
                    "Agent intelligence",
                    "Inspection tools (voice notes, photos, checklists)",
                    "Gmail integration",
                    "Couples/partner mode",
                    "Priority support",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 h-11 bg-[#0D9488] font-semibold text-white hover:bg-[#0F766E]"
                  asChild
                >
                  <Link href="/sign-up">Start free trial</Link>
                </Button>
                <p className="mt-2 text-center text-xs text-[#6B7280]">
                  14 days free · No credit card required
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-20 border-t border-[#E5E7EB] py-14 sm:py-16 lg:py-20"
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Common questions
            </h2>
            <dl className="mt-10 space-y-4">
              {faqs.map((item) => (
                <div
                  key={item.q}
                  className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-4"
                >
                  <dt className="font-semibold text-[#111827]">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-[#E5E7EB] bg-gray-900 py-14 text-white sm:py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Start your property search the smart way
            </h2>
            <p className="mt-3 text-base text-[#D1D5DB] sm:text-lg">
              Join Australian buyers who are searching smarter with PropTrackr
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 bg-[#0D9488] px-8 text-base font-semibold text-white hover:bg-[#14B8A6]"
              asChild
            >
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2"
              >
                Get started for free
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <p className="mt-4 text-sm text-[#9CA3AF]">
              Free plan available · No credit card required · Cancel anytime
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <Link href="/landing" className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
                  <Building2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span className="text-lg font-semibold text-[#111827]">
                  PropTrackr
                </span>
              </Link>
              <p className="mt-3 max-w-sm text-sm text-[#6B7280]">
                PropTrackr · Your AI property buying companion
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <Link
                href="#features"
                className="text-[#6B7280] hover:text-[#0D9488]"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="text-[#6B7280] hover:text-[#0D9488]"
              >
                Pricing
              </Link>
              <Link
                href="/sign-in"
                className="text-[#6B7280] hover:text-[#0D9488]"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="text-[#6B7280] hover:text-[#0D9488]"
              >
                Sign up
              </Link>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-[#E5E7EB] pt-8 text-sm text-[#6B7280] sm:flex-row sm:flex-wrap sm:gap-x-6">
            <Link href="#privacy-policy" className="hover:text-[#0D9488]">
              Privacy Policy
            </Link>
            <Link href="#terms-of-service" className="hover:text-[#0D9488]">
              Terms of Service
            </Link>
          </div>
          <p
            id="privacy-policy"
            className="mt-6 scroll-mt-20 text-xs leading-relaxed text-[#9CA3AF]"
          >
            <strong className="text-[#6B7280]">Privacy:</strong> We handle your
            data with care. Full policy coming soon — contact us if you have
            questions about how we store and use your information.
          </p>
          <p
            id="terms-of-service"
            className="mt-4 scroll-mt-20 text-xs leading-relaxed text-[#9CA3AF]"
          >
            <strong className="text-[#6B7280]">Terms:</strong> By using
            PropTrackr you agree to our terms of use. Full legal text coming
            soon.
          </p>
          <p className="mt-8 text-center text-xs text-[#9CA3AF]">
            © 2026 PropTrackr. Built for Australian buyers.
          </p>
        </div>
      </footer>
    </div>
  );
}
