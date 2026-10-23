"use client";

import { RouteError } from "@/components/route-error";

export default function MemberError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load your membership. Check your internet and try again." />;
}
