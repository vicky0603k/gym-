import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/utils/cn";

/** Loading skeleton — shimmering placeholder block */
export function LoadingSkeleton({
  className,
  lines = 3,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={cn("animate-pulse space-y-3", className)} aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 bg-surface-2 rounded",
            i === lines - 1 ? "w-2/3" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

/** Empty state — used when a list has no items, plus the next action */
export function EmptyState({
  icon = <Inbox className="h-10 w-10" />,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 text-muted" aria-hidden>
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
      {message && <p className="text-sm text-muted max-w-xs">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Error state — full plain-language message, never a blank screen */
export function ErrorState({
  title = "Something went wrong",
  message = "Please try again. If the problem continues, ask the front desk for help.",
  action,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <AlertTriangle className="h-10 w-10 mb-4 text-danger" aria-hidden />
      <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted max-w-xs mb-6">{message}</p>
      {action}
    </div>
  );
}
