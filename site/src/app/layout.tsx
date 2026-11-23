import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { ScrollTop } from "@/components/ScrollTop";
import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flickctx — mark screen, route to a session, keep chatting",
  description:
    "Mark anything on screen. Route into an OpenCode or Claude Code session — no Flickctx API key — or use built-in vision chat.",
  metadataBase: new URL("https://flickctx.vercel.app"),
  openGraph: {
    title: "Flickctx",
    description:
      "Mark anything on screen. Route into an OpenCode or Claude Code session — no Flickctx API key — or use built-in vision chat.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <ScrollTop />
        {children}
      </body>
    </html>
  );
}
