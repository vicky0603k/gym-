"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

/** Navigation link that highlights itself for its section. `exact` for section roots. */
export function NavLink({
  href,
  exact,
  className,
  children,
}: {
  href: string;
  exact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(className, active ? "text-accent" : "text-muted hover:text-foreground")}
    >
      {children}
    </Link>
  );
}
