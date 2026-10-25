import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Toaster } from "sonner";
import { getSettings } from "@/services/settings";
import "./globals.css";

// One family for the whole app (UI.md §3.2): the width axis gives the condensed display figures;
// latin-ext carries the ₹ sign.
const archivo = Archivo({ subsets: ["latin", "latin-ext"], axes: ["wdth"], display: "swap", variable: "--font-archivo" });

// Tab titles carry the gym's own name from Settings, never a product placeholder.
export async function generateMetadata(): Promise<Metadata> {
  let gymName = process.env.NEXT_PUBLIC_GYM_NAME || "Gym";
  try {
    gymName = (await getSettings()).gym_name || gymName;
  } catch {
    // Settings unreachable: keep the fallback; the page's own error state explains the problem.
  }
  return {
    title: { default: gymName, template: `%s — ${gymName}` },
    description: "Track your attendance, renew your membership and achieve your weekly fitness goal.",
    applicationName: gymName,
    appleWebApp: { capable: true, statusBarStyle: "default", title: gymName },
    formatDetection: { telephone: false },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
    other: { "mobile-web-app-capable": "yes" },
  };
}

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="min-h-screen bg-background">
        {children}
        <Toaster theme="light" position="top-center" richColors toastOptions={{ className: "font-sans" }} />
      </body>
    </html>
  );
}
