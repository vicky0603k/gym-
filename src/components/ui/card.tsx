import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

/**
 * Cards are for objects (a plan, an add-on, a membership) — lists use <List> rows (UI.md §8).
 * soft = light grey surface (default), plain = white with a hairline, dark = the black card.
 */
export const cardVariants = cva("rounded-lg", {
  variants: {
    tone: {
      soft: "bg-surface",
      plain: "border border-border bg-background",
      dark: "bg-foreground text-background",
      warning: "border-2 border-warning bg-background",
    },
    pad: { none: "", sm: "p-4", md: "p-5" },
  },
  defaultVariants: { tone: "soft", pad: "md" },
});

export function Card({
  className,
  tone,
  pad,
  as: Tag = "section",
  ...props
}: React.HTMLAttributes<HTMLElement> & VariantProps<typeof cardVariants> & { as?: "section" | "div" | "article" | "li" }) {
  return <Tag className={cn(cardVariants({ tone, pad }), className)} {...props} />;
}

/** Small muted label on the left, a strong value or action on the right — the mockup's card header. */
export function CardHeader({ label, children, className }: { label: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <p className="text-sm text-muted">{label}</p>
      {children}
    </div>
  );
}
