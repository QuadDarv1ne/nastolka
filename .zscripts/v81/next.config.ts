import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "https://preview-chat-db4afbe9-30bd-4b68-8a32-24f437dff00a.space-z.ai",
    "*.space-z.ai",
  ],
};

export default nextConfig;
