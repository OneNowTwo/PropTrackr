export default function PlannerPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Inspection planner
      </h1>
      <p className="text-ink-muted">
        Schedule and track open homes. Connect to the{" "}
        <code className="rounded border border-line bg-white px-1.5 py-0.5 text-sm text-ink shadow-sm">
          inspections
        </code>{" "}
        table to render your calendar here.
      </p>
    </div>
  );
}
