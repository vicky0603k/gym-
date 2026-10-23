import type { MetadataRoute } from "next";

const GYM_NAME = process.env.NEXT_PUBLIC_GYM_NAME ?? "Gym";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: GYM_NAME,
    short_name: GYM_NAME,
    description: "Gym attendance, renewals and weekly goals — in your pocket.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0F0C",
    theme_color: "#0B0F0C",
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
