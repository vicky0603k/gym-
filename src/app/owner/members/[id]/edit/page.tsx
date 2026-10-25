import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentStaff } from "@/services/auth";
import { getMemberProfile, listActiveTrainers } from "@/services/members";
import { MemberForm } from "../../member-form";

export const metadata = { title: "Edit member" };

export default async function EditMemberPage({ params }: { params: { id: string } }) {
  const staff = await getCurrentStaff();
  if (staff?.role !== "Owner") redirect(`/owner/members/${params.id}`);

  const [member, trainers] = await Promise.all([getMemberProfile(params.id), listActiveTrainers()]);
  if (!member) notFound();

  return (
    <div className="mx-auto w-full px-4 pb-8 pt-4 md:px-6 md:pt-6 max-w-2xl">
      <Link
        href={`/owner/members/${member.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground min-h-[48px]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> {member.name}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Edit member</h1>
      <div className="card p-5">
        <MemberForm
          mode="edit"
          memberId={member.id}
          trainers={trainers}
          defaults={{
            name: member.name,
            phone: member.phone,
            weeklyTarget: member.weekly_target,
            trainerId: member.assigned_trainer_id,
          }}
        />
      </div>
    </div>
  );
}
