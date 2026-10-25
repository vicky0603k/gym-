import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserCog } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { listStaff } from "@/services/staff";
import { EmptyState } from "@/components/states";
import { AddStaffDialog, ResetStaffPasswordDialog, StaffAccessDialog } from "./staff-dialogs";

export const metadata = { title: "Staff logins" };
export const dynamic = "force-dynamic";

/** Owner only: who can log in to the staff app. */
export default async function StaffPage() {
  const me = await getCurrentStaff();
  if (me?.role !== "Owner") redirect("/owner");
  const staff = await listStaff();
  const others = staff.filter((s) => s.id !== me.id);

  return (
    <div className="mx-auto w-full px-4 pb-8 pt-4 md:px-6 md:pt-6 max-w-2xl space-y-4">
      <Link href="/owner/settings" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Settings
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Staff logins</h1>
        <AddStaffDialog />
      </div>

      <section className="card p-4">
        <p className="font-medium text-foreground">{me.name} (you)</p>
        <p className="text-sm text-muted break-all">{me.email} · Owner</p>
      </section>

      {others.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={<UserCog className="h-10 w-10" />}
            title="No front-desk logins yet"
            message="Add one for each person at the desk, so check-ins and payments show who recorded them."
          />
        </section>
      ) : (
        <ul className="card divide-y divide-border">
          {others.map((s) => (
            <li key={s.id} className="p-4 space-y-3">
              <div>
                <p className="font-medium text-foreground">
                  {s.name} {!s.isActive && <span className="ml-1 text-sm text-danger">· access removed</span>}
                </p>
                <p className="text-sm text-muted break-all">
                  {s.email || "No email"} · {s.role === "Owner" ? "Owner" : "Front desk"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {s.isActive && <ResetStaffPasswordDialog staffId={s.id} name={s.name} />}
                <StaffAccessDialog staffId={s.id} name={s.name} active={s.isActive} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
