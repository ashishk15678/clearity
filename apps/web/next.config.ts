import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir:"../../dist/web",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
