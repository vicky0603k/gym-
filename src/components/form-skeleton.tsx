import { LoadingSkeleton } from "./states";

/** Loading state for detail and form pages: title + one card of content. */
export function PageSkeleton({ cards = 1 }: { cards?: number }) {
  return (
    <div className="p-4 md:p-6 max-w-xl space-y-4" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded bg-surface-2 mt-12" />
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="card p-5">
          <LoadingSkeleton lines={4} />
        </div>
      ))}
    </div>
  );
}
