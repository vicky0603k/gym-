import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

/** Initials in a circle — people never get a stock avatar. */
export const avatarVariants = cva("inline-flex shrink-0 items-center justify-center rounded-full font-bold", {
  variants: {
    tone: { volt: "bg-accent text-accent-foreground", soft: "bg-surface-2 text-foreground", dark: "bg-foreground text-background" },
    size: { sm: "h-9 w-9 text-xs", md: "h-11 w-11 text-sm", lg: "h-14 w-14 text-base" },
  },
  defaultVariants: { tone: "soft", size: "md" },
});

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function Avatar({ name, tone, size, className }: { name: string; className?: string } & VariantProps<typeof avatarVariants>) {
  return (
    <span className={cn(avatarVariants({ tone, size }), className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

/**
 * The week's visits as segments that fill black (the approved mockup's "plates on a bar").
 * Extra visits past the target show as a volt "+n".
 */
export function VisitSegments({ done, target, paused, className }: { done: number; target: number; paused?: boolean; className?: string }) {
  const extra = Math.max(done - target, 0);
  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-hidden>
      {Array.from({ length: target }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-7 flex-1 rounded-md",
            i < done ? "plate-in bg-foreground" : paused ? "border-2 border-dashed border-warning" : "bg-surface-2"
          )}
          style={i < done ? { animationDelay: `${i * 80}ms` } : undefined}
        />
      ))}
      {extra > 0 && <span className="rounded-md bg-accent px-2 py-1 text-sm font-bold text-accent-foreground">+{extra}</span>}
    </div>
  );
}

/** A KPI tile: label, condensed number, optional sub-line; links to the list behind the number. */
export function Stat({
  href,
  icon: Icon,
  label,
  value,
  sub,
  tone,
  className,
}: {
  href: string;
  icon?: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "warning" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[116px] flex-col rounded-lg p-4 transition-colors",
        dark ? "bg-foreground text-background hover:bg-foreground/90" : "bg-surface hover:bg-surface-2",
        className
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-sm", dark ? "text-background/70" : "text-muted")}>
        {Icon && <Icon className="h-4 w-4" aria-hidden />} {label}
      </span>
      <span
        className={cn(
          "num-display mt-2 text-4xl",
          dark ? "text-accent" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground"
        )}
      >
        {value}
      </span>
      {sub && <span className={cn("mt-auto pt-1 text-xs", dark ? "text-background/70" : "text-muted")}>{sub}</span>}
    </Link>
  );
}

/** Horizontal filter chips; the selected one is black. Pass hrefs so filters live in the URL. */
export function Chips({ items, label }: { items: { href: string; label: string; count?: number; active: boolean }[]; label: string }) {
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={label}>
      {items.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          aria-current={c.active ? "true" : undefined}
          className={cn(
            "inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
            c.active ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted hover:text-foreground"
          )}
        >
          {c.label}
          {c.count !== undefined && <span className={cn("tabular-nums", c.active ? "text-background/70" : "text-muted")}>{c.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
