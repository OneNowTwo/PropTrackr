import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Toaster } from "@/components/ui/toaster";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "PropTrackr — Property buyer dashboard",
  description:
    "Save, track, and compare properties during your home search.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable} suppressHydrationWarning>
        <body className="min-h-screen bg-[#F8F9FA] font-sans antialiased text-ink">
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
