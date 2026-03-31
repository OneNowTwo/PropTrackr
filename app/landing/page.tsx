import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0F172A] text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(13, 148, 136, 0.25), transparent)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-6 lg:px-10">
        <span className="text-lg font-semibold tracking-tight">PropTrackr</span>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
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
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          Your home search,{" "}
          <span className="text-primary">structured and clear</span>
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
          Save listings, plan inspections, capture notes, and compare options
          in one calm workspace — built for decisions that matter.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" className="min-w-[160px] shadow-lg shadow-primary/20" asChild>
            <Link href="/sign-up">Start free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
