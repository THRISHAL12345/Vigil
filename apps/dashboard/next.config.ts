import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vigil/database", "@vigil/schemas", "@vigil/logger"],
};

export default nextConfig;
