import Link from "next/link";
import { requireMember } from "@/services/auth";
import { getAttendanceHistory } from "@/services/attendance";
import { AttendanceList, HISTORY_PAGE_SIZE, pageParam } from "@/components/attendance-list";
import { Page, PageHeader } from "@/components/ui/page";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "My visits" };

/** The signed-in member's own check-ins only (member id comes from the session). */
export default async function MemberAttendancePage({ searchParams }: { searchParams: { page?: string } }) {
  const { memberId } = await requireMember();
  const page = pageParam(searchParams.page);
  const visits = await getAttendanceHistory(memberId, page, HISTORY_PAGE_SIZE, 1);

  return (
    <Page>
      <PageHeader title="My visits" back={{ href: "/member/more", label: "More" }} />
      <AttendanceList
        visits={visits}
        page={page}
        basePath="/member/attendance"
        emptyMessage="Your gym visits will show here after your first check-in."
        emptyAction={<Link href="/member/check-in" className={buttonVariants()}>Check in now</Link>}
      />
    </Page>
  );
}
