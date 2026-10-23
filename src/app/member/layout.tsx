import Link from "next/link";
import { cn } from "@/utils/cn";

/**
 * Member layout — bottom navigation: Home, Check-in, Add-ons, More.
 * Mobile-first, fixed bottom bar with 48px tap targets.
 */

const navItems = [
  { href: "/member", label: "Home", icon: "🏠" },
  { href: "/member/check-in", label: "Check-in", icon: "📷" },
  { href: "/member/add-ons", label: "Add-ons", icon: "🛒" },
  { href: "/member/more", label: "More", icon: "☰" },
];

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-16">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40">
        <div className="flex justify-around items-stretch max-w-md mx-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 min-h-[56px]",
                "text-muted hover:text-foreground transition-colors flex-1"
              )}
            >
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
