import { CreditCard, Home, Menu, ScanLine, ShoppingBag } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { LogoutButton } from "@/components/logout-button";

/**
 * Member layout — bottom navigation, mobile-first, 56px tap targets.
 * Tabs per DESIGN.md: Home, Check-in, Renew, Add-ons, More (visits, payments, settings).
 */

const navItems = [
  { href: "/member", label: "Home", icon: Home, exact: true },
  { href: "/member/check-in", label: "Check-in", icon: ScanLine, exact: false },
  { href: "/member/renew", label: "Renew", icon: CreditCard, exact: false },
  { href: "/member/add-ons", label: "Add-ons", icon: ShoppingBag, exact: false },
  { href: "/member/more", label: "More", icon: Menu, exact: false, also: ["/member/attendance", "/member/payments", "/member/settings"] },
];

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-end px-4 pt-2 max-w-md w-full mx-auto">
        <LogoutButton />
      </header>
      <main className="flex-1 pb-16">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40">
        <div className="flex justify-around items-stretch max-w-md mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              also={"also" in item ? item.also : undefined}
              className="flex flex-col items-center justify-center gap-1 px-4 py-2 min-h-[56px] transition-colors flex-1"
            >
              <item.icon className="h-5 w-5" aria-hidden />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
