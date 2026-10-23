export default function RedListLoading() {
  return (
    <div className="p-4 md:p-6 max-w-3xl animate-pulse" aria-label="Loading Red List">
      <div className="h-8 w-36 rounded bg-surface-2 mb-2" />
      <div className="h-4 w-64 rounded bg-surface-2 mb-4" />
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-24 rounded-full bg-surface-2" />
        ))}
      </div>
      <div className="card divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-4 space-y-3">
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-full bg-surface-2" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-surface-2" />
                <div className="h-3 w-2/3 rounded bg-surface-2" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-12 rounded-lg bg-surface-2" />
              <div className="h-12 rounded-lg bg-surface-2" />
              <div className="h-12 rounded-lg bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
