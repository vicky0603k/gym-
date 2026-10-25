import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

/** Rows with hairline dividers inside one rounded frame — for lists, not cards (UI.md §8). */
export function List({ className, children, label }: { className?: string; children: React.ReactNode; label?: string }) {
  return (
    <ul className={cn("divide-y divide-border overflow-hidden rounded-lg border border-border bg-background", className)} aria-label={label}>
      {children}
    </ul>
  );
}

/**
 * One row: optional leading slot (avatar/icon), title + meta, trailing slot (badge/amount).
 * With `href` the whole row is the tap target and gets a chevron.
 */
export function ListRow({
  href,
  leading,
  title,
  meta,
  trailing,
  className,
  children,
}: {
  href?: string;
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-sm text-muted">{meta}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right">{trailing}</span>}
      {href && <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
    </>
  );
  return (
    <li className={className}>
      {href ? (
        <Link href={href} className="flex min-h-[64px] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface">
          {body}
        </Link>
      ) : (
        <div className="flex min-h-[64px] items-center gap-3 px-4 py-3">{body}</div>
      )}
      {children}
    </li>
  );
}
