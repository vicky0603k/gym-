"use client";

import { RouteError } from "@/components/route-error";

export default function RedListError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load the Red List. Check your internet and try again." />;
}
