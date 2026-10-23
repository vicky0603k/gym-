export default function MembersLoading() {
  return (
    <div className="p-4 md:p-6 max-w-3xl animate-pulse" aria-label="Loading members">
      <div className="h-8 w-40 rounded bg-surface-2 mb-4" />
      <div className="h-12 rounded-lg bg-surface-2 mb-3" />
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-20 rounded-full bg-surface-2" />
        ))}
      </div>
      <div className="card divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-10 w-10 rounded-full bg-surface-2" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-surface-2" />
              <div className="h-3 w-1/3 rounded bg-surface-2" />
            </div>
            <div className="h-6 w-14 rounded-full bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
