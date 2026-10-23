import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "@/utils/cn";
import { getCurrentStaff } from "@/services/auth";
import { LogoutButton } from "@/components/logout-button";

/**
 * Owner layout — navigation: Dashboard, Red List, Members, Renewals, Add-ons, Settings.
 * Mobile: bottom bar; Desktop: side bar (expanded).
 */

const navItems = [
  { href: "/owner", label: "Dashboard", icon: "📊" },
  { href: "/owner/red-list", label: "Red List", icon: "📋" },
  { href: "/owner/members", label: "Members", icon: "👥" },
  { href: "/owner/renewals", label: "Renewals", icon: "💳" },
  { href: "/owner/add-ons", label: "Add-ons", icon: "🛒" },
  { href: "/owner/settings", label: "Settings", icon: "⚙️" },
];

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware only knows "signed in"; a staff_users row is what makes someone staff.
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

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
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg min-h-[48px]",
                "text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              )}
            >
              <span aria-hidden>{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
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
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 min-h-[56px] flex-1",
                "text-muted hover:text-foreground transition-colors"
              )}
            >
              <span className="text-lg" aria-hidden>{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
