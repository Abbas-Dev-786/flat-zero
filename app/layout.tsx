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
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/60 via-slate-50 to-slate-50">{children}</body>
    </html>
  );
}
