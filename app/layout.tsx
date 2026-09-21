import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coromandel CPC | Purchase & Retailer Analytics Dashboard",
  description:
    "Full-stack analytics, retailer verification tracking, and anomaly detection dashboard for Coromandel International Crop Protection Chemicals (CPC) network.",
  icons: {
    icon: "/coro_logo.png",
    shortcut: "/coro_logo.png",
    apple: "/coro_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
