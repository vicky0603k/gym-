"use client";

import { RouteError } from "@/components/route-error";

export default function MembersError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load members. Check your internet and try again." />;
}
