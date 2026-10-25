import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

/** Page width and gutter for member (phone) and owner (wider) screens. */
export function Page({ width = "member", className, children }: { width?: "member" | "owner" | "wide"; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pb-8 pt-4",
        width === "member" ? "max-w-md" : width === "owner" ? "max-w-2xl md:px-6 md:pt-6" : "max-w-5xl md:px-6 md:pt-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Title block: optional back link, a muted line above the title, the title, an action on the right. */
export function PageHeader({
  title,
  kicker,
  description,
  back,
  action,
  className,
}: {
  title: React.ReactNode;
  kicker?: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5", className)}>
      {back && (
        <Link href={back.href} className="-ml-1 mb-2 inline-flex min-h-[40px] items-center gap-1 text-sm text-muted hover:text-foreground">
          <ChevronLeft className="h-4 w-4" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {kicker && <p className="text-sm text-muted">{kicker}</p>}
          <h1 className="break-words text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

/** A titled group of content with an optional "see all" link. */
export function Section({
  title,
  link,
  className,
  children,
  id,
}: {
  title: React.ReactNode;
  link?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section className={cn("mt-6", className)} aria-labelledby={id}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id={id} className="font-semibold text-foreground">
          {title}
        </h2>
        {link && (
          <Link href={link.href} className="inline-flex min-h-[40px] items-center gap-0.5 text-sm font-medium text-foreground underline-offset-4 hover:underline">
            {link.label} <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
