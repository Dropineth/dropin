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

/**
 * Structured data (schema.org). Modeled with real vocabulary — Organization +
 * DataCatalog + Dataset — and kept deliberately honest: CanopyProof is described
 * as open, public-interest infrastructure with transparent, auditable,
 * append-only proof records. It does NOT assert "tamper-proof verified" outcomes
 * as fact, because the current interface serves clearly-labeled demonstration
 * data and public dataset access is still in development.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "CanopyProof",
      url: siteUrl,
      logo: CANOPYPROOF_LOGO_SRC,
      description:
        "Open, public-interest environmental accountability infrastructure by Dropin: transparent, auditable proof records for ecological restoration.",
      parentOrganization: { "@type": "Organization", name: "Dropin" },
    },
    {
      "@type": "DataCatalog",
      "@id": `${siteUrl}/#data-catalog`,
      name: "CanopyProof Environmental Proof Catalog",
      url: `${siteUrl}/#explorer`,
      description:
        "A catalog of ecological restoration proof records — evidence sources, verification status, monitoring state, and proof references — for transparent climate accountability. Public dataset access is in active development; values in the current interface are clearly labeled sample data.",
      isAccessibleForFree: true,
      creativeWorkStatus: "Prototype",
      provider: { "@id": `${siteUrl}/#organization` },
      keywords: [
        "reforestation",
        "ecological restoration",
        "environmental accountability",
        "MRV",
        "open climate data",
        "digital public good",
      ],
      dataset: [
        {
          "@type": "Dataset",
          name: "Restoration proof records (sample)",
          description:
            "Append-only, auditable environmental proof records linking field evidence, GPS/EXIF metadata, satellite cross-checks, and verification status. Current records are demonstration data for interface evaluation, not certified carbon credits or verified claims about specific real-world projects.",
          license: "https://opensource.org/licenses/MIT",
          isAccessibleForFree: true,
          creator: { "@id": `${siteUrl}/#organization` },
          measurementTechnique: [
            "Field evidence capture",
            "Metadata / EXIF ingestion",
            "Satellite cross-validation",
            "Human-reviewed AI assistance",
          ],
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          // application/ld+json is a non-executable data block (not subject to
          // script-src execution), so it needs no CSP nonce.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
