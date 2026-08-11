export function KpiCardSkeleton() {
  return (
    <div className="admin-surface rounded-xl border p-5 shadow-sm">
      <div className="h-3 w-24 rounded bg-[var(--admin-subtle)] motion-safe:animate-pulse" />
      <div className="mt-3 h-8 w-32 rounded bg-[var(--admin-subtle)] motion-safe:animate-pulse" />
      <div className="mt-3 h-3 w-20 rounded bg-[var(--admin-hover)] motion-safe:animate-pulse" />
    </div>
  );
}

export function ChartCardSkeleton() {
  return (
    <div className="admin-surface rounded-xl border p-6 shadow-sm">
      <div className="mb-4 h-4 w-40 rounded bg-[var(--admin-subtle)] motion-safe:animate-pulse" />
      <div className="h-64 rounded-lg bg-[var(--admin-subtle)] motion-safe:animate-pulse" />
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading insights">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
