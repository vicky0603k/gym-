"use client";

import { RouteError } from "@/components/route-error";

export default function MemberSettingsError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load your settings. Check your internet and try again." />;
}
