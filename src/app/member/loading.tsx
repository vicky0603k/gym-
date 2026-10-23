import { LoadingSkeleton } from "@/components/states";

export default function MemberHomeLoading() {
  return (
    <div className="px-6 py-6 max-w-md mx-auto">
      <LoadingSkeleton lines={2} className="mb-6 w-1/2" />
      <div className="card p-5">
        <LoadingSkeleton lines={4} />
      </div>
    </div>
  );
}
