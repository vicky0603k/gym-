import { requireMember } from "@/services/auth";
import { getMemberProfile } from "@/services/members";
import { getMemberIdPrefix } from "@/services/settings";
import { formatMemberCode } from "@/utils/member-code";
import { Scanner } from "./scanner";

export const metadata = { title: "Check in" };

export default async function CheckInPage() {
  const { memberId } = await requireMember();
  const [profile, prefix] = await Promise.all([getMemberProfile(memberId), getMemberIdPrefix()]);
  return <Scanner memberCode={profile ? formatMemberCode(prefix, profile.member_code) : null} />;
}
