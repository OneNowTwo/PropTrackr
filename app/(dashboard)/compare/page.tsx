import { GitCompareArrows } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
          Compare
        </h1>
        <p className="mt-2 max-w-2xl text-[#6B7280]">
          Side-by-side comparison for two shortlisted properties. Use the{" "}
          <code className="rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 text-sm text-[#111827] shadow-sm">
            comparisons
          </code>{" "}
          table and AI summaries when you are ready.
        </p>
      </div>

      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <GitCompareArrows className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg text-[#111827]">Coming soon</CardTitle>
            <CardDescription className="text-[#6B7280]">
              Pick two properties and generate an AI summary of trade-offs,
              price, and features.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-[#6B7280]">
          Shortlist properties from your list, then connect this view to the
          comparisons model.
        </CardContent>
      </Card>
    </div>
  );
}
