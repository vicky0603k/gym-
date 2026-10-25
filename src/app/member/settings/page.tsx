import { notFound } from "next/navigation";
import { requireMember } from "@/services/auth";
import { getMemberPreferences } from "@/services/members";
import { PreferenceToggles } from "./preference-toggles";
import { Page, PageHeader } from "@/components/ui/page";

export const metadata = { title: "Message settings" };

export default async function MemberSettingsPage() {
  const { memberId } = await requireMember();
  const prefs = await getMemberPreferences(memberId);
  if (!prefs) notFound();

  return (
    <Page>
      <PageHeader
        title="Message settings"
        description="Choose which messages the gym sends you. Changes apply straight away."
        back={{ href: "/member/more", label: "More" }}
      />
      <PreferenceToggles initial={prefs} />
      <p className="mt-4 text-sm text-muted">
        Payment confirmations and receipts always reach you, because they are about money you paid. The front desk may still call you.
      </p>
    </Page>
  );
}
