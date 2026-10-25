"use client";

import { RouteError } from "@/components/route-error";

export default function StaffError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load staff logins. Check your internet and try again." />;
}
