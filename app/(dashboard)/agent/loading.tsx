export default function AgentLoading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#E5E7EB]" />
        <div className="space-y-1">
          <div className="h-6 w-40 rounded bg-[#E5E7EB]" />
          <div className="h-4 w-64 rounded bg-[#E5E7EB]" />
        </div>
      </div>

      {/* Urgent */}
      <div className="space-y-3">
        <div className="h-5 w-48 rounded bg-[#E5E7EB]" />
        <div className="h-20 rounded-xl bg-[#E5E7EB]" />
        <div className="h-20 rounded-xl bg-[#E5E7EB]" />
      </div>

      {/* Pipeline */}
      <div className="space-y-3">
        <div className="h-5 w-36 rounded bg-[#E5E7EB]" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-[#E5E7EB]" />
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        <div className="h-5 w-28 rounded bg-[#E5E7EB]" />
        <div className="h-24 rounded-xl bg-[#E5E7EB]" />
      </div>

      {/* Chat bar */}
      <div className="h-14 rounded-xl bg-[#E5E7EB]" />
    </div>
  );
}
