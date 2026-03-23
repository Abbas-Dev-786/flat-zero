import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Apartment Hunter & Negotiator",
  description: "Find and negotiate your dream apartment using AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background">{children}</body>
    </html>
  );
}
