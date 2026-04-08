import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DataProvider } from "@/components/providers/data-provider";
import { TerminalShell } from "@/components/shell/terminal-shell";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/providers/sw-register";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "GRAHAM 2026",
  description: "Graham Platner for U.S. Senate — real-time campaign intelligence terminal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GRAHAM",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <DataProvider>
          <TerminalShell>
            {children}
          </TerminalShell>
        </DataProvider>
        <Analytics />
        <ServiceWorkerRegister />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#1c1e2d",
              border: "1px solid #FFD700",
              color: "#c8c8d8",
              fontFamily: "Berkeley Mono, monospace",
              fontSize: "11px",
            },
          }}
        />
      </body>
    </html>
  );
}
