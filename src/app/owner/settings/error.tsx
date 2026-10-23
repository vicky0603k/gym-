"use client";

import { RouteError } from "@/components/route-error";

export default function SettingsError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load settings. Check your internet and try again." />;
}
