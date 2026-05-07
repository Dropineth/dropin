import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dropin Earth Mini App",
  description: "Telegram Mini App entry for Tree Lotto and Ticket Seeds.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
