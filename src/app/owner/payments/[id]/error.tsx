"use client";

import { RouteError } from "@/components/route-error";

export default function ReceiptError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load this payment. Check your internet and try again." />;
}
