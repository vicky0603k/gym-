"use client";

import { RouteError } from "@/components/route-error";

export default function PlansError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load plans. Check your internet and try again." />;
}
