import type { NextConfig } from "next";

// Fail loudly at build/dev start if the ingest URL is not configured.
// NEXT_PUBLIC_* vars are baked in at build time — a missing value means
// every snippet, curl example, and SDK script tag in the console will
// silently point nowhere.
if (!process.env.NEXT_PUBLIC_INGEST_URL) {
  const msg =
    "[clarity] NEXT_PUBLIC_INGEST_URL is not set. " +
    "Add it to apps/web/.env before building or starting the dev server. " +
    "The ingest URL is required for SDK setup, curl examples, and tracking.";
  // In CI/production treat it as a hard error; in local dev warn but continue.
  if (process.env.NODE_ENV === "production") {
    throw new Error(msg);
  } else {
    console.warn("\n⚠️  " + msg + "\n");
  }
}

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
  // typescript: { ignoreBuildErrors: true }, // removed — fix type errors, don't hide them
};

export default nextConfig;
