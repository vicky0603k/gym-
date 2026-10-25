import { Block } from "@/components/states";

/** Shaped like member home: greeting, the black membership card, the check-in button, the plate bar. */
export default function MemberHomeLoading() {
  return (
    <div className="mx-auto max-w-md px-4 py-4" aria-label="Loading">
      <Block className="mb-4 h-8 w-32" />
      <div className="rounded-lg bg-foreground/90 p-5">
        <div className="h-4 w-24 rounded bg-background/20" />
        <div className="mt-2 h-5 w-32 rounded bg-background/30" />
        <div className="mt-8 h-12 w-56 rounded bg-background/20" />
        <div className="mt-8 h-4 w-40 rounded bg-background/20" />
      </div>
      <Block className="mt-4 h-14 w-full rounded-lg" />
      <div className="card mt-4 p-5">
        <Block className="h-5 w-32" />
        <Block className="mt-4 h-12 w-24" />
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Block key={i} className="h-16 flex-1" />
          ))}
        </div>
      </div>
    </div>
  );
}
