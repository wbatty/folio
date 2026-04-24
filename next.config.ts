import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdf-parse-new", "playwright"],
  transpilePackages: ["decant"],
  cacheComponents: true,
};

export default nextConfig;
