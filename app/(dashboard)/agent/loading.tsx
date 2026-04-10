export default function AgentLoading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-5xl gap-6 pb-16 md:pb-0">
      <div className="hidden w-72 shrink-0 animate-pulse space-y-4 md:block">
        <div className="h-48 rounded-xl bg-[#E5E7EB]" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-[#E5E7EB]" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 animate-pulse flex-col overflow-hidden rounded-xl border border-[#E5E7EB]">
        <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-[#E5E7EB]" />
          <div className="space-y-1">
            <div className="h-4 w-32 rounded bg-[#E5E7EB]" />
            <div className="h-3 w-24 rounded bg-[#E5E7EB]" />
          </div>
        </div>
        <div className="flex-1 space-y-4 p-4">
          <div className="flex gap-2">
            <div className="h-7 w-7 rounded-full bg-[#E5E7EB]" />
            <div className="h-32 flex-1 rounded-2xl bg-[#E5E7EB]" />
          </div>
        </div>
        <div className="border-t border-[#E5E7EB] p-4">
          <div className="h-10 rounded-xl bg-[#E5E7EB]" />
        </div>
      </div>
    </div>
  );
}
