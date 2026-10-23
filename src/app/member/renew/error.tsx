"use client";

import { RouteError } from "@/components/route-error";

export default function RenewError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load renewal options. Check your internet and try again." />;
}
