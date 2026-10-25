"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

/** Navigation link that highlights itself for its section. `exact` for section roots; `also` for sub-pages it owns. */
export function NavLink({
  href,
  exact,
  also = [],
  className,
  children,
}: {
  href: string;
  exact?: boolean;
  also?: string[];
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  const active = (exact ? pathname === href : under(href)) || also.some(under);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(className, "group", active ? "text-foreground font-semibold" : "text-muted hover:text-foreground")}
    >
      {children}
    </Link>
  );
}
