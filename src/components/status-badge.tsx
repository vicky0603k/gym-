import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

type Tone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

// Good states are a volt fill with black text; volt is never text on white (UI.md §3.1).
const TONE: Record<string, Tone> = {
  Active: "volt",
  Paid: "volt",
  Returned: "volt",
  Completed: "volt",
  Paused: "warning",
  Frozen: "warning",
  "Awaiting confirmation": "warning",
  Pending: "muted",
  Inactive: "muted",
  Replaced: "muted",
  Refunded: "outline",
};

/** Member, membership, payment or plan status pill. A Frozen membership reads "Paused" to people. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={TONE[status] ?? "danger"} className={className}>
      {status === "Frozen" ? "Paused" : status}
    </Badge>
  );
}
