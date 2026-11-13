import type { Metadata } from "next";
import { headers } from "next/headers";
import { isProductionSite } from "@/data/life/navigation";
import { LIFEPP_PUBLIC_BRAND } from "@/data/life/public-brand";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const siteUrl = "https://canopyproof.org";
const iconUrl = "/icon.jpg";
const appleTouchIconUrl = "/apple-touch-icon.jpg";
const siteTitle = "CanopyProof | Environmental Evidence & Learning";
const siteDescription =
  "Explore environmental evidence, try nature-learning activities with children and prepare a pilot enquiry for your school or organisation. Sample records are clearly labelled.";

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
        url: iconUrl,
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
    images: [iconUrl],
  },
  icons: {
    icon: [{ url: iconUrl, sizes: "400x400", type: "image/jpeg" }],
    shortcut: [{ url: iconUrl, sizes: "400x400", type: "image/jpeg" }],
    apple: [{ url: appleTouchIconUrl, sizes: "400x400", type: "image/jpeg" }],
  },
  robots: {
    index: isProductionSite,
    follow: isProductionSite,
  },
};

/** Public descriptions distinguish the current examples from verified project data. */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "CanopyProof Limited",
      url: siteUrl,
      logo: `${siteUrl}${iconUrl}`,
      description:
        "CanopyProof by Dropin helps people explore environmental evidence and nature learning, with sample records, learning demos and information about possible pilots.",
      brand: [{ "@type": "Brand", name: "CanopyProof" }, { "@type": "Brand", name: LIFEPP_PUBLIC_BRAND }],
    },
    {
      "@type": "DataCatalog",
      "@id": `${siteUrl}/#data-catalog`,
      name: "CanopyProof Environmental Record Examples",
      url: `${siteUrl}/#explorer`,
      description:
        "Examples of how environmental records can show sources, review status and supporting information. The current interface contains labelled sample data; it is not a catalog of verified project results.",
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
          name: "Environmental records (sample)",
          description:
            "Sample environmental records for learning how to read sources and review status. These examples contain no certified carbon credits or verified claims about specific real-world projects.",
          license: "https://opensource.org/licenses/MIT",
          isAccessibleForFree: true,
          creator: { "@id": `${siteUrl}/#organization` },
        },
      ],
    },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The homepage keeps force-static. Other routes already use nonce CSP middleware;
  // request rendering binds their language and bootstrap scripts to that request.
  const locale = (await headers()).get("x-life-locale") === "zh" ? "zh-CN" : "en";
  return (
    <html lang={locale}>
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
