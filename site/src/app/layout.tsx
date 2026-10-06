import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import { JsonLd } from "@/components/JsonLd";
import { SmoothScroll } from "@/components/SmoothScroll";
import { themeScript } from "@/components/ThemeToggle";
import { AUTHOR_URL, DESCRIPTION, SITE_URL, TITLE } from "@/lib/site";
import "./globals.css";

const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "gyotaku",
  keywords: [
    "screenshot search",
    "search screenshots by text",
    "OCR screenshot search",
    "find text in screenshots",
    "offline OCR",
    "Linux",
    "Windows",
    "open source",
  ],
  authors: [{ name: "xevrion", url: AUTHOR_URL }],
  creator: "xevrion",
  category: "utilities",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "gyotaku",
    locale: "en_US",
    title: "gyotaku: ctrl f for your screenshots",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "gyotaku: ctrl f for your screenshots",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: { title: "gyotaku" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Before first paint, so a saved theme never flashes the other one. */}
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className="min-h-dvh">
        <JsonLd />
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
