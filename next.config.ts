import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@prisma/adapter-pg", "pg", "playwright"],
};

export default nextConfig;
