"use client";

import { RouteError } from "@/components/route-error";

export default function AttendanceError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load your visits. Check your internet and try again." />;
}
