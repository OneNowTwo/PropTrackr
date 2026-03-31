import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F9FA] text-ink">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -15%, rgba(13, 148, 136, 0.12), transparent 55%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between border-b border-line bg-white/80 px-6 py-5 backdrop-blur-sm lg:px-10">
        <span className="text-lg font-semibold tracking-tight text-ink">
          PropTrackr
        </span>
        <div className="flex gap-3">
          <Button variant="ghost" className="text-ink-muted hover:text-ink" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </header>
      <main className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-16 text-center lg:pt-24">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
          For serious buyers
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
          Your home search,{" "}
          <span className="text-primary">structured and clear</span>
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-lg text-ink-muted">
          Save listings, plan inspections, capture notes, and compare options
          in one calm workspace — built for decisions that matter.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            className="min-w-[160px] shadow-md shadow-primary/15"
            asChild
          >
            <Link href="/sign-up">Start free</Link>
          </Button>
          <Button size="lg" variant="outline" className="border-line bg-white" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
