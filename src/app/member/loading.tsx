import { LoadingSkeleton } from "@/components/states";

export default function MemberHomeLoading() {
  return (
    <div className="px-6 py-6 max-w-md mx-auto">
      <LoadingSkeleton lines={2} className="mb-6 w-1/2" />
      <div className="card p-5 mb-4">
        <LoadingSkeleton lines={4} />
      </div>
      <div className="card p-5 flex items-center gap-5 animate-pulse" aria-label="Loading weekly goal">
        <div className="h-[104px] w-[104px] shrink-0 rounded-full border-[10px] border-surface-2" />
        <LoadingSkeleton lines={2} className="flex-1" />
      </div>
    </div>
  );
}
