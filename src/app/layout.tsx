import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

const GYM_NAME = process.env.NEXT_PUBLIC_GYM_NAME ?? "Gym Retention PWA";

export const metadata: Metadata = {
  title: {
    default: GYM_NAME,
    template: `%s — ${GYM_NAME}`,
  },
  description:
    "Track your attendance, renew your membership and achieve your weekly fitness goal.",
  applicationName: GYM_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: GYM_NAME,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F0C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-background">
        {children}
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
