import { CreditCard, Home, Menu, ScanLine, ShoppingBag } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { InstallPrompt } from "@/components/install-prompt";

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
      <main className="flex-1 pb-20">{children}</main>
      {/* Renders nothing; loads the install hook on every member page so Chrome's one-time event is caught. */}
      <InstallPrompt show={false} />

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-stretch max-w-md mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              also={"also" in item ? item.also : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap px-1 py-1.5 min-h-[60px] transition-colors"
            >
              {/* Active tab: the icon sits on a black tile (mockup C). */}
              <span className="flex h-8 w-12 items-center justify-center rounded-md transition-colors group-aria-[current=page]:bg-foreground group-aria-[current=page]:text-background">
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-xs">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
