import { Block } from "@/components/states";

/** Shaped like the landing page: black hero with the gym name, then plan cards. */
export default function LandingLoading() {
  return (
    <div aria-label="Loading">
      <div className="bg-foreground px-4 pb-12 pt-14">
        <div className="mx-auto max-w-3xl">
          <div className="h-14 w-64 animate-pulse rounded bg-background/20" />
          <div className="mt-4 h-4 w-48 animate-pulse rounded bg-background/20" />
          <div className="mt-8 h-12 w-full animate-pulse rounded-lg bg-background/20 sm:w-56" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <Block className="mb-4 h-6 w-48" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5">
              <Block className="h-5 w-24" />
              <Block className="mt-3 h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
