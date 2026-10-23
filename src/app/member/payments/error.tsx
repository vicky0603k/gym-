"use client";

import { RouteError } from "@/components/route-error";

export default function PaymentsError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load your payments. Check your internet and try again." />;
}
