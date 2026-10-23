import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMemberProfile } from "@/services/members";
import { getAttendanceHistory } from "@/services/attendance";
import { AttendanceList, HISTORY_PAGE_SIZE, pageParam } from "@/components/attendance-list";

export const metadata = { title: "Attendance" };

export default async function MemberAttendancePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string };
}) {
  const member = await getMemberProfile(params.id);
  if (!member) notFound();
  const page = pageParam(searchParams.page);
  const visits = await getAttendanceHistory(member.id, page, HISTORY_PAGE_SIZE, 1);

  return (
    <div className="p-4 md:p-6 max-w-xl">
      <Link
        href={`/owner/members/${member.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> {member.name}
      </Link>
      <h1 className="text-2xl font-bold text-foreground mb-4">Attendance</h1>
      <AttendanceList
        visits={visits}
        page={page}
        basePath={`/owner/members/${member.id}/attendance`}
        emptyMessage={`${member.name} hasn't checked in yet.`}
      />
    </div>
  );
}
