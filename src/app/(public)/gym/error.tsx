"use client";

import { RouteError } from "@/components/route-error";

export default function LandingError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} message="We couldn't load the gym's details. Check your internet and try again." />;
}
