import { redirect } from "next/navigation";
import { IndianRupee, LayoutDashboard, Settings, ShoppingBag, UserCheck, UserX, Users } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { getGymName } from "@/services/renewals";
import { LogoutButton } from "@/components/logout-button";
import { NavLink } from "@/components/nav-link";

/**
 * Owner layout — mobile: bottom bar; desktop: side bar (expanded).
 * Mobile bottom bar holds six sections; Settings sits in the mobile top bar instead.
 * Settings is Owner-only (front desk has no settings access); Plans live under Settings.
 * Gate QR opens full screen over this layout, from the Check-in page.
 */

const navItems = [
  { href: "/owner", label: "Dashboard", short: "Home", icon: LayoutDashboard, exact: true },
  { href: "/owner/red-list", label: "Red List", icon: UserX, exact: false },
  { href: "/owner/members", label: "Members", icon: Users, exact: false },
  { href: "/owner/renewals", label: "Renewals", icon: IndianRupee, exact: false },
  { href: "/owner/check-in", label: "Check-in", icon: UserCheck, exact: false },
  { href: "/owner/add-ons", label: "Add-ons", icon: ShoppingBag, exact: false },
  { href: "/owner/settings", label: "Settings", icon: Settings, exact: false, ownerOnly: true },
];

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware only knows "signed in"; a staff_users row is what makes someone staff.
  const [staff, gymName] = await Promise.all([getCurrentStaff(), getGymName()]);
  if (!staff) redirect("/login");
  const nav = navItems.filter((item) => !("ownerOnly" in item) || staff.role === "Owner");

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-surface border-r border-border p-4">
        <div className="mb-8 px-3">
          <p className="truncate text-lg font-bold text-foreground">{gymName}</p>
          <p className="text-sm text-muted">{staff.role === "Owner" ? "Owner" : "Front desk"}</p>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              className="flex min-h-[48px] items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface-2 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
            >
              <item.icon className="h-5 w-5" aria-hidden />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-border">
          <p className="px-3 text-sm text-foreground truncate">{staff.name}</p>
          <p className="px-3 text-xs text-muted mb-2">{staff.role === "Owner" ? "Owner" : "Front desk"}</p>
          <LogoutButton compact className="w-full justify-start" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between gap-3 border-b border-border px-4 py-1">
        <span className="min-w-0">
          <span className="block truncate font-bold text-foreground">{gymName}</span>
          <span className="block truncate text-xs text-muted">{staff.name} · {staff.role === "Owner" ? "Owner" : "Front desk"}</span>
        </span>
        <div className="flex items-center">
          {staff.role === "Owner" && (
            <NavLink href="/owner/settings" also={["/owner/plans"]} className="btn-ghost px-3">
              <Settings className="h-5 w-5" aria-hidden />
              <span className="sr-only">Settings</span>
            </NavLink>
          )}
          <LogoutButton compact />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex justify-around items-stretch overflow-x-auto">
          {nav.filter((item) => item.href !== "/owner/settings").map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              className="flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 transition-colors"
            >
              <span className="flex h-8 w-12 items-center justify-center rounded-md transition-colors group-aria-[current=page]:bg-foreground group-aria-[current=page]:text-background">
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="max-w-full truncate text-xs">{"short" in item ? item.short : item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
