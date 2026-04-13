import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdf-parse-new", "playwright"],
};

export default nextConfig;
