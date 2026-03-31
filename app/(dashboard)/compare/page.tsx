export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Compare</h1>
      <p className="text-ink-muted">
        Side-by-side comparison for two shortlisted properties. Use the{" "}
        <code className="rounded border border-line bg-white px-1.5 py-0.5 text-sm text-ink shadow-sm">
          comparisons
        </code>{" "}
        table and OpenAI summaries when you are ready.
      </p>
    </div>
  );
}
