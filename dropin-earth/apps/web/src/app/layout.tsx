import type { Metadata } from "next";
import { CANOPYPROOF_LOGO_SRC } from "@/components/canopyproof/logo";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const siteUrl = "https://canopyproof.org";
const siteTitle = "CanopyProof — Environmental Accountability for Ecological Restoration";
const siteDescription =
  "CanopyProof by Dropin turns restoration evidence into transparent environmental records, impact certificates, and traceable proof workflows.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  alternates: {
    canonical: "https://canopyproof.org",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "CanopyProof",
    images: [
      {
        url: CANOPYPROOF_LOGO_SRC,
        width: 400,
        height: 400,
        alt: "CanopyProof by Dropin logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [CANOPYPROOF_LOGO_SRC],
  },
  icons: {
    icon: [{ url: CANOPYPROOF_LOGO_SRC, sizes: "400x400", type: "image/jpeg" }],
    shortcut: [{ url: CANOPYPROOF_LOGO_SRC, sizes: "400x400", type: "image/jpeg" }],
    apple: [{ url: CANOPYPROOF_LOGO_SRC, sizes: "400x400", type: "image/jpeg" }],
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
