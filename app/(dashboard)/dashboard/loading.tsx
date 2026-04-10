export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-[#E5E7EB]" />
        <div className="h-8 w-48 animate-pulse rounded bg-[#E5E7EB]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-xl bg-[#E5E7EB]" />
        ))}
      </div>
      <div className="h-20 animate-pulse rounded-xl bg-[#E5E7EB]" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-[#E5E7EB]" />
        <div className="h-56 animate-pulse rounded-xl bg-[#E5E7EB]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-[#E5E7EB]" />
        ))}
      </div>
    </div>
  );
}
