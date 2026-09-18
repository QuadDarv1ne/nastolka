import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Разрешаем dev-запросы с превью-доменов (для облачных деплоев: Amvera, space-z.ai и т.п.)
  allowedDevOrigins: [
    "https://preview-chat-db4afbe9-30bd-4b68-8a32-24f437dff00a.space-z.ai",
    "*.space-z.ai",
  ],
};

export default nextConfig;
