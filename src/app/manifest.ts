import type { MetadataRoute } from "next";
import { getSettings } from "@/services/settings";

// The installed app is labelled with the gym's name from Settings.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = process.env.NEXT_PUBLIC_GYM_NAME || "Gym";
  try {
    name = (await getSettings()).gym_name || name;
  } catch {
    // Keep the fallback name if settings can't be read.
  }
  return {
    name,
    short_name: name.length > 12 ? name.split(/\s+/)[0] : name,
    description: "Gym attendance, renewals and weekly goals — in your pocket.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    orientation: "portrait",
    categories: ["fitness", "health"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [],
  };
}
