export default function PlannerPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Inspection planner</h1>
      <p className="text-muted-foreground">
        Schedule and track open homes. Connect to the{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">
          inspections
        </code>{" "}
        table to render your calendar here.
      </p>
    </div>
  );
}
