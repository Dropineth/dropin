import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dropin Earth V1",
  description:
    "Google-Earth-like Tree Lotto, verified planting evidence, Impact Certificates, and Red Team Challenge Layer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
