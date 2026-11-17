/**
 * SDK bundle script
 *
 * The canonical SDK output is the hand-maintained IIFE at
 *   apps/web/public/clarity.js
 *
 * This script:
 *   1. Verifies that file exists and is non-empty.
 *   2. Writes the version banner from package.json into the first line comment.
 *   3. Copies to packages/sdk/dist/clarity.js for npm consumers (if any).
 *
 * To add a proper minification step:
 *   npm install -D esbuild
 *   replace the copyFile call with an esbuild.build({ ... minify: true }) call.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "../../..");
const src       = resolve(root, "apps/web/public/clarity.js");
const distDir   = resolve(__dirname, "../dist");
const dist      = resolve(distDir, "clarity.js");

// ── 1. Verify source ─────────────────────────────────────────────────────────
if (!existsSync(src)) {
  console.error(`[sdk] ERROR: ${src} not found.`);
  console.error("       Edit apps/web/public/clarity.js — it is the source of truth.");
  process.exit(1);
}

const code = readFileSync(src, "utf8");
if (code.trim().length < 100) {
  console.error("[sdk] ERROR: clarity.js looks empty or truncated.");
  process.exit(1);
}

// ── 2. Update version banner ──────────────────────────────────────────────────
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));
const versioned = code.replace(
  /Clarity Analytics SDK\s+v[\d.]+/,
  `Clarity Analytics SDK  v${pkg.version}`
);

// ── 3. Write dist ─────────────────────────────────────────────────────────────
mkdirSync(distDir, { recursive: true });
writeFileSync(dist, versioned, "utf8");
// Also write back to source so the banner is always current
writeFileSync(src, versioned, "utf8");

const kb = (versioned.length / 1024).toFixed(1);
console.log(`[sdk] ✓ clarity.js  ${kb} KB  →  dist/clarity.js`);
