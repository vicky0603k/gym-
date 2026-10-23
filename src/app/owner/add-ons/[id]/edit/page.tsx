import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { getAddon } from "@/services/addons";
import { listActiveTrainers } from "@/services/members";
import { AddonForm } from "../../addon-form";

export const metadata = { title: "Edit add-on" };

export default async function EditAddonPage({ params }: { params: { id: string } }) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") redirect("/owner/add-ons");
  const [addon, trainers] = await Promise.all([getAddon(params.id), listActiveTrainers()]);
  if (!addon) notFound();

  return (
    <div className="p-4 md:p-6 max-w-xl">
      <Link href="/owner/add-ons" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Add-ons
      </Link>
      <h1 className="text-2xl font-bold text-foreground mb-1">Edit {addon.title}</h1>
      <p className="text-sm text-muted mb-6">Price changes apply to new orders only.</p>
      <div className="card p-5">
        <AddonForm addon={addon} trainers={trainers} />
      </div>
    </div>
  );
}
