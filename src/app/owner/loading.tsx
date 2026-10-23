export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl animate-pulse" aria-label="Loading dashboard">
      <div className="h-8 w-40 rounded bg-surface-2 mb-2" />
      <div className="h-4 w-24 rounded bg-surface-2 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="card p-4 min-h-[112px] space-y-3">
            <div className="h-3 w-2/3 rounded bg-surface-2" />
            <div className="h-8 w-1/2 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
