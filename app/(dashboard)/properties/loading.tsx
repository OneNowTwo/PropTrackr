export default function PropertiesLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-32 animate-pulse rounded bg-[#E5E7EB]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-[#E5E7EB]">
            <div className="h-48 animate-pulse bg-[#E5E7EB]" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[#E5E7EB]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[#E5E7EB]" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-[#E5E7EB]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
