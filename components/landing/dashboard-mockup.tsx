/** Dashboard UI placeholder for marketing hero — not real data. */
export function DashboardMockup({ className }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-lg ${className ?? ""}`}
    >
      <div className="flex h-[min(420px,55vw)] min-h-[280px] text-left text-[11px] sm:text-xs">
        <aside className="hidden w-[28%] shrink-0 border-r border-[#E5E7EB] bg-[#F8F9FA] sm:block">
          <div className="border-b border-[#E5E7EB] p-3">
            <div className="h-2 w-16 rounded bg-[#0D9488]/30" />
          </div>
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`rounded-lg p-2 ${i === 1 ? "bg-[#0D9488]/10 ring-1 ring-[#0D9488]/25" : "bg-white"}`}
              >
                <div className="h-2 w-full max-w-[90%] rounded bg-[#E5E7EB]" />
                <div className="mt-1.5 h-1.5 w-12 rounded bg-[#D1D5DB]" />
              </div>
            ))}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-3 py-2.5 sm:px-4">
            <div className="h-2 w-24 rounded bg-[#111827]/80" />
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-md bg-[#F3F4F6]" />
              <div className="h-6 w-16 rounded-md bg-[#0D9488]/90" />
            </div>
          </header>
          <div className="flex-1 space-y-3 overflow-hidden p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-[#E5E7EB] to-[#F3F4F6]" />
              <div className="hidden rounded-lg bg-[#F8F9FA] ring-1 ring-[#E5E7EB] sm:block">
                <div className="h-full w-full rounded-lg bg-[#0D9488]/5" />
              </div>
              <div className="hidden rounded-lg bg-[#F8F9FA] ring-1 ring-[#E5E7EB] lg:block" />
            </div>
            <div className="space-y-2 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA]/80 p-3">
              <div className="h-2 w-3/4 max-w-[200px] rounded bg-[#111827]/70" />
              <div className="h-1.5 w-full max-w-[280px] rounded bg-[#D1D5DB]" />
              <div className="h-1.5 w-full max-w-[240px] rounded bg-[#E5E7EB]" />
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#6B7280] ring-1 ring-[#E5E7EB]">
                  Inspection Sat 10:30
                </span>
                <span className="rounded-full bg-[#0D9488]/10 px-2 py-0.5 text-[10px] font-medium text-[#0D9488]">
                  Shortlisted
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="border-t border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 text-center text-[10px] text-[#9CA3AF] sm:text-xs">
        Dashboard preview — your workspace will look like this
      </p>
    </div>
  );
}
