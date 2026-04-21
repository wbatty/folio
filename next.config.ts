import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdf-parse-new", "playwright"],
  transpilePackages: ["decant"],
};

export default nextConfig;
