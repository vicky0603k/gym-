import { notFound } from "next/navigation";
import { requireMember } from "@/services/auth";
import { getMemberPreferences } from "@/services/members";
import { PreferenceToggles } from "./preference-toggles";

export const metadata = { title: "Message settings" };

export default async function MemberSettingsPage() {
  const { memberId } = await requireMember();
  const prefs = await getMemberPreferences(memberId);
  if (!prefs) notFound();

  return (
    <div className="px-6 py-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">Message settings</h1>
      <p className="text-sm text-muted mb-4">Choose which messages the gym sends you. Changes apply straight away.</p>
      <PreferenceToggles initial={prefs} />
      <p className="mt-4 text-xs text-muted">
        Payment confirmations and receipts always reach you, because they are about money you paid. The front desk may still call you.
      </p>
    </div>
  );
}
