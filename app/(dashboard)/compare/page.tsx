export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
      <p className="text-muted-foreground">
        Side-by-side comparison for two shortlisted properties. Use the{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">
          comparisons
        </code>{" "}
        table and OpenAI summaries when you are ready.
      </p>
    </div>
  );
}
