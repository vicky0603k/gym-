import { Bell, History, ReceiptIndianRupee, ShieldCheck } from "lucide-react";
import { requireMember } from "@/services/auth";
import { getMemberProfile } from "@/services/members";
import { getGymName } from "@/services/renewals";
import { getMemberIdPrefix } from "@/services/settings";
import { formatMemberCode } from "@/utils/member-code";
import { formatPhone } from "@/utils/phone";
import { LogoutButton } from "@/components/logout-button";
import { Avatar } from "@/components/ui/bits";
import { List, ListRow } from "@/components/ui/list";
import { Page } from "@/components/ui/page";

export const metadata = { title: "More" };
export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/member/attendance", label: "My visits", hint: "Every check-in, newest first", icon: History },
  { href: "/member/payments", label: "Payments and receipts", hint: "Renewals and add-ons", icon: ReceiptIndianRupee },
  { href: "/member/settings", label: "Message settings", hint: "Reminders and offers", icon: Bell },
  { href: "/privacy", label: "Privacy", hint: "What the gym keeps about you", icon: ShieldCheck },
];

function IconTile({ icon: Icon }: { icon: typeof History }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-foreground">
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

export default async function MemberMorePage() {
  const { memberId } = await requireMember();
  const [profile, gymName, prefix] = await Promise.all([getMemberProfile(memberId), getGymName(), getMemberIdPrefix()]);

  return (
    <Page>
      <header className="mb-6 flex items-center gap-3">
        <Avatar name={profile?.name ?? ""} tone="volt" size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-foreground">{profile?.name}</h1>
          <p className="text-sm text-muted">
            {profile ? formatPhone(profile.phone) : ""} · {gymName}
          </p>
          {profile && (
            <p className="text-sm font-semibold tabular-nums tracking-wider text-foreground">
              <span className="sr-only">Member ID </span>
              {formatMemberCode(prefix, profile.member_code)}
            </p>
          )}
        </div>
      </header>

      <List label="Your account">
        {LINKS.map((l) => (
          <ListRow key={l.href} href={l.href} leading={<IconTile icon={l.icon} />} title={l.label} meta={l.hint} />
        ))}
      </List>

      <div className="mt-6">
        <LogoutButton className="w-full" />
      </div>
    </Page>
  );
}
