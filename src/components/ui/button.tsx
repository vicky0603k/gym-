import { forwardRef } from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

/**
 * One button definition for the whole app (UI.md §4: cva + Radix Slot, shadcn pattern).
 * primary = volt fill + black text (the one main action); dark = black; outline; ghost; danger.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent-muted",
        dark: "bg-foreground text-background hover:bg-foreground/85",
        outline: "border border-border-strong bg-background text-foreground hover:bg-surface",
        ghost: "text-foreground hover:bg-surface-2",
        danger: "border border-danger bg-background text-danger hover:bg-danger/5",
        onDark: "border border-background/40 bg-transparent text-background hover:bg-background/10",
      },
      size: {
        sm: "min-h-[40px] px-3 text-sm",
        md: "min-h-[48px] px-5 text-base",
        lg: "min-h-[56px] px-6 text-lg",
        icon: "h-12 w-12",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  }
);

type Variants = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, Variants {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
});

/** A Next.js link styled as a button. */
export function ButtonLink({
  className,
  variant,
  size,
  block,
  ...props
}: React.ComponentProps<typeof Link> & Variants) {
  return <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
