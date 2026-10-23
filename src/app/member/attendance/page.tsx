import Link from "next/link";
import { requireMember } from "@/services/auth";
import { getAttendanceHistory } from "@/services/attendance";
import { AttendanceList, HISTORY_PAGE_SIZE, pageParam } from "@/components/attendance-list";

export const metadata = { title: "My visits" };

/** The signed-in member's own check-ins only (member id comes from the session). */
export default async function MemberAttendancePage({ searchParams }: { searchParams: { page?: string } }) {
  const { memberId } = await requireMember();
  const page = pageParam(searchParams.page);
  const visits = await getAttendanceHistory(memberId, page, HISTORY_PAGE_SIZE, 1);

  return (
    <div className="px-6 py-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-4">My visits</h1>
      <AttendanceList
        visits={visits}
        page={page}
        basePath="/member/attendance"
        emptyMessage="Your gym visits will show here after your first check-in."
        emptyAction={<Link href="/member/check-in" className="btn-primary">Check in now</Link>}
      />
    </div>
  );
}
