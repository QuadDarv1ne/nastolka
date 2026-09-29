import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { VisitorTracker } from "@/components/visitor-tracker";
import { AdminFAB } from "@/components/admin-fab";
import { NicknamePrompt } from "@/components/nickname-prompt";

export const metadata: Metadata = {
  title: "Nastolka — board game",
  description:
    "Interactive version of the Nastolka board game from the Shalnov & Beburishvili show. Two teams, a dice, and 4 ways to explain: words, songs, drawing, and gestures.",
  keywords: ["Nastolka", "board game", "dice", "Shalnov", "Beburishvili", "party game"],
  authors: [{ name: "Inspired by Nastolka show" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Nastolka" },
  openGraph: {
    title: "Nastolka — board game",
    description: "Roll the dice, explain words, and earn points for your team.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#100943" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <VisitorTracker />
        <AdminFAB />
        <NicknamePrompt lang="ru" />
        <Toaster />
      </body>
    </html>
  );
}
