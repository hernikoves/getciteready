import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const TITLE =
  "CiteReady — Paste a URL. Get the files AI search can actually quote.";
const DESCRIPTION =
  "CiteReady is an implementation pack, not a tracker. Spec-compliant llms.txt, FAQ schema, and citation-ready answers from your own page. $19.";

const site = getSiteUrl();

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(site),
  alternates: { canonical: site },
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: site,
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
