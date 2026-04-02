"use client";

import { SignUp } from "@clerk/nextjs";
import { Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type PlanId = "free" | "pro";

export function SignUpWithPlan() {
  const searchParams = useSearchParams();
  const initialFromUrl = useMemo((): PlanId => {
    const p = searchParams.get("plan")?.toLowerCase();
    return p === "pro" ? "pro" : "free";
  }, [searchParams]);

  const [selectedPlan, setSelectedPlan] = useState<PlanId>(initialFromUrl);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Choose a plan to get started — you can change or upgrade later.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setSelectedPlan("free")}
          className={cn(
            "relative rounded-xl border-2 p-4 text-left transition-all",
            selectedPlan === "free"
              ? "border-[#0D9488] bg-[#0D9488]/5 shadow-sm ring-1 ring-[#0D9488]/20"
              : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]",
          )}
        >
          {selectedPlan === "free" && (
            <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#0D9488] text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          )}
          <p className="font-semibold text-[#111827]">Free</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            Up to 5 properties, planner &amp; notes
          </p>
          <p className="mt-2 text-lg font-semibold text-[#111827]">$0</p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedPlan("pro")}
          className={cn(
            "relative rounded-xl border-2 p-4 text-left transition-all",
            selectedPlan === "pro"
              ? "border-[#0D9488] bg-[#0D9488]/5 shadow-sm ring-1 ring-[#0D9488]/20"
              : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]",
          )}
        >
          {selectedPlan === "pro" && (
            <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#0D9488] text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          )}
          <p className="font-semibold text-[#111827]">Pro</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            Unlimited listings, AI compare, voice notes &amp; more
          </p>
          <p className="mt-2 text-lg font-semibold text-[#0D9488]">$19/mo</p>
        </button>
      </div>

      <SignUp
        key={selectedPlan}
        unsafeMetadata={{
          selectedPlan,
          planSource: "signup_ui",
        }}
        appearance={{
          elements: {
            rootBox: "mx-auto w-full",
            card: "bg-white border border-[#E5E7EB] shadow-sm rounded-xl",
          },
          variables: {
            colorPrimary: "#0D9488",
            colorBackground: "#ffffff",
            colorInputBackground: "#F9FAFB",
            colorText: "#111827",
            colorTextSecondary: "#6B7280",
          },
        }}
      />
    </div>
  );
}
