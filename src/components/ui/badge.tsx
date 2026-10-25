import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

/** Pills. Good = volt fill (never volt text on white); risk and warning keep their own colours. */
export const badgeVariants = cva("inline-flex shrink-0 items-center gap-1 rounded-full font-semibold", {
  variants: {
    tone: {
      volt: "bg-accent text-accent-foreground",
      dark: "bg-foreground text-background",
      warning: "bg-warning/10 text-warning",
      danger: "bg-danger/10 text-danger",
      muted: "bg-surface-2 text-muted",
      outline: "border border-border-strong text-foreground",
      // Solid fills for use on the black card, where tinted text would fail contrast.
      warningSolid: "bg-warning text-background",
      dangerSolid: "bg-danger text-background",
    },
    size: { sm: "px-2 py-0.5 text-xs", md: "px-2.5 py-1 text-xs" },
  },
  defaultVariants: { tone: "muted", size: "md" },
});

export function Badge({ className, tone, size, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
