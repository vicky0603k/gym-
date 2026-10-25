import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";

// A new revision per build so a changed offline page replaces the cached one.
const revision = randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // The offline fallback (sw.ts `fallbacks`) is served from the precache, so it must be in it.
  additionalPrecacheEntries: [
    { url: "/offline.html", revision },
    { url: "/icons/icon-192.png", revision },
  ],
  // Disable in development so HMR works cleanly
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // No next/image in the app: switching the optimizer off closes the /_next/image
  // endpoint and its advisories on Next 14 (see SECURITY.md §8).
  images: {
    unoptimized: true,
  },
};

export default withSerwist(nextConfig);
