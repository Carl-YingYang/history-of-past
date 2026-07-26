import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Project Noor — A Stranger in San Diego",
  description:
    "An educational Pokémon-style RPG that drops a 2026 Filipino college student into José Rizal's 1887 Noli Me Tangere. Explore San Diego, meet its people, and earn the Listener medal.",
  keywords: [
    "Project Noor",
    "Noli Me Tangere",
    "José Rizal",
    "Philippine history",
    "educational RPG",
    "Filipino literature",
    "1887",
    "San Diego",
    "Crisóstomo Ibarra",
  ],
  authors: [{ name: "Project Noor Team" }],
  applicationName: "Project Noor",
  category: "education",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Project Noor — A Stranger in San Diego",
    description:
      "Step into 1887 San Diego. An educational RPG based on José Rizal's Noli Me Tangere.",
    siteName: "Project Noor",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Project Noor",
    description: "An educational RPG based on José Rizal's Noli Me Tangere (1887).",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1c1917",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
