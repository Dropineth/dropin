import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dropin Admin",
  description: "Operations console for Dropin Earth V1.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
