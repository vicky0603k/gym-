import { redirect } from "next/navigation";
import { IndianRupee, LayoutDashboard, Settings, UserCheck, UserX, Users } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { LogoutButton } from "@/components/logout-button";
import { NavLink } from "@/components/nav-link";

/**
 * Owner layout — mobile: bottom bar; desktop: side bar (expanded).
 * A section is listed only once its screen exists (Add-ons come later).
 * Settings is Owner-only (front desk has no settings access); Plans live under Settings.
 * Gate QR opens full screen over this layout, from the Check-in page.
 */

const navItems = [
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/owner/red-list", label: "Red List", icon: UserX, exact: false },
  { href: "/owner/members", label: "Members", icon: Users, exact: false },
  { href: "/owner/renewals", label: "Renewals", icon: IndianRupee, exact: false },
  { href: "/owner/check-in", label: "Check-in", icon: UserCheck, exact: false },
  { href: "/owner/settings", label: "Settings", icon: Settings, exact: false, ownerOnly: true },
];

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware only knows "signed in"; a staff_users row is what makes someone staff.
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  const nav = navItems.filter((item) => !("ownerOnly" in item) || staff.role === "Owner");

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-surface border-r border-border p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <span className="text-lg font-black text-accent-foreground">F</span>
          </div>
          <span className="font-bold text-foreground">Owner Panel</span>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              className="flex items-center gap-3 px-3 py-3 rounded-lg min-h-[48px] hover:bg-surface-2 transition-colors"
            >
              <item.icon className="h-5 w-5" aria-hidden />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-border">
          <p className="px-3 text-sm text-foreground truncate">{staff.name}</p>
          <p className="px-3 text-xs text-muted mb-2">{staff.role === "Owner" ? "Owner" : "Front desk"}</p>
          <LogoutButton className="w-full text-left" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 pt-2 border-b border-border">
        <span className="text-sm text-foreground truncate">{staff.name}</span>
        <LogoutButton />
      </header>

      {/* Main content */}
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40 md:hidden">
        <div className="flex justify-around items-stretch overflow-x-auto">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              className="flex flex-col items-center justify-center gap-1 px-1 py-2 min-h-[56px] min-w-0 flex-1 transition-colors"
            >
              <item.icon className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate text-[11px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
