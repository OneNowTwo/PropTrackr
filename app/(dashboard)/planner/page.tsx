import { CalendarDays } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PlannerPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
          Inspection planner
        </h1>
        <p className="mt-2 max-w-2xl text-[#6B7280]">
          Schedule and track open homes. Connect to the{" "}
          <code className="rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 text-sm text-[#111827] shadow-sm">
            inspections
          </code>{" "}
          table to render your calendar here.
        </p>
      </div>

      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg text-[#111827]">Coming soon</CardTitle>
            <CardDescription className="text-[#6B7280]">
              Your inspection times will appear in a weekly view with links
              back to each property.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-[#6B7280]">
          Add properties from the dashboard, then wire this page to your
          database when you are ready.
        </CardContent>
      </Card>
    </div>
  );
}
