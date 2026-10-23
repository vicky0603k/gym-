"use client";

import { RouteError } from "@/components/route-error";

export default function CheckInError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't search members. Check your internet and try again." />;
}
