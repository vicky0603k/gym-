"use client";

import { RouteError } from "@/components/route-error";

export default function OwnerError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load this page. Check your internet and try again." />;
}
