export default function SuburbLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-[#E5E7EB]" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-[#E5E7EB]" />
      <div className="h-64 animate-pulse rounded-xl bg-[#E5E7EB]" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-[#E5E7EB]" />
        ))}
      </div>
    </div>
  );
}
