import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const display = localFont({
  src: "./fonts/space-grotesk-var.woff2",
  variable: "--font-display",
  weight: "300 700",
  display: "swap",
});

const body = localFont({
  src: "./fonts/inter-var.woff2",
  variable: "--font-body",
  weight: "100 900",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/jetbrains-mono-var.woff2",
  variable: "--font-mono",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Company Assessment — Prospect Signal Intelligence",
  description:
    "Prospect signal intelligence for CTS Mobility: upload a company list, research it against public sources, and rank by fit + trigger score.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
