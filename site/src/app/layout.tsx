import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Syne } from "next/font/google";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
  display: "swap",
  // Prevent size-adjust fallback metrics from making Syne look horizontally stretched
  adjustFontFallback: false,
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: false,
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Flickctx — mark screen, ask, keep chatting",
  description:
    "Mark a region on screen, ask about it, keep chatting. Follow incidents across AWS, Datadog, and your local repos.",
  metadataBase: new URL("https://flickctx.vercel.app"),
  openGraph: {
    title: "Flickctx",
    description:
      "Mark a region on screen, ask about it, keep chatting. Follow incidents across AWS, Datadog, and your local repos.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e8eaec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
