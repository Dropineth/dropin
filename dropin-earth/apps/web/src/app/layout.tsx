import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://canopyproof.org"),
  title: "CanopyProof — Environmental Accountability for Ecological Restoration",
  description:
    "CanopyProof by Dropin turns restoration evidence into transparent environmental records, impact certificates, and traceable proof workflows.",
  alternates: {
    canonical: "https://canopyproof.org",
  },
  openGraph: {
    title: "CanopyProof — Environmental Accountability for Ecological Restoration",
    description:
      "CanopyProof by Dropin turns restoration evidence into transparent environmental records, impact certificates, and traceable proof workflows.",
    url: "https://canopyproof.org",
    siteName: "CanopyProof",
    images: [
      {
        url: "/og/canopyproof-og.svg",
        width: 1200,
        height: 630,
        alt: "CanopyProof by Dropin environmental accountability interface",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CanopyProof — Environmental Accountability for Ecological Restoration",
    description:
      "CanopyProof by Dropin turns restoration evidence into transparent environmental records, impact certificates, and traceable proof workflows.",
    images: ["/og/canopyproof-og.svg"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
