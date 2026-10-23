import { LoadingSkeleton } from "@/components/states";

export default function LandingLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 pt-16" aria-label="Loading">
      <div className="mx-auto mb-6 h-16 w-16 animate-pulse rounded-2xl bg-surface-2 md:mx-0" />
      <LoadingSkeleton lines={3} className="mb-10 max-w-md" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <LoadingSkeleton lines={2} />
          </div>
        ))}
      </div>
    </div>
  );
}
