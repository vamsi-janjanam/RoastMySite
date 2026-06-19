import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🔥 Roast My Site 🔥",
  description:
    "Paste your URL and let an AI roast it mercilessly — scored across 7 categories, with a savage final verdict.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
