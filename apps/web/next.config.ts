import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // distDir: "../../dist/web",
  transpilePackages: ["pg"],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
