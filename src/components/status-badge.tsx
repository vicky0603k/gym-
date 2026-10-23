import { cn } from "@/utils/cn";

const TONE: Record<string, string> = {
  Active: "bg-accent/10 text-accent",
  Paused: "bg-warning/10 text-warning",
  Frozen: "bg-warning/10 text-warning",
  Pending: "bg-surface-2 text-muted",
  Inactive: "bg-surface-2 text-muted",
};

/** Member, membership or plan status pill. A Frozen membership reads "Paused" to people. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold",
        TONE[status] ?? "bg-danger/10 text-danger",
        className
      )}
    >
      {status === "Frozen" ? "Paused" : status}
    </span>
  );
}
