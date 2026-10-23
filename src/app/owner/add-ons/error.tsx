"use client";

import { RouteError } from "@/components/route-error";

export default function OwnerAddonsError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load add-ons. Check your internet and try again." />;
}
