import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "«Настолка» — играем в настольную игру",
  description:
    "Интерактивная версия настольной игры «Настолка» из шоу Шальнова и Бебуришвили. Две команды, кубик и 4 способа объяснения: словами, песнями, рисунком и жестами.",
  keywords: ["Настолка", "настольная игра", "кубик", "Шальнов", "Бебуришвили", "вечеринка"],
  authors: [{ name: "Inspired by «Настолка» show" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg", sizes: "any" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Настолка",
  },
  openGraph: {
    title: "«Настолка» — играем в настольную игру",
    description:
      "Бросай кубик, объясняй слова и зарабатывай очки для своей команды.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a14" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
