"use client";

/**
 * UserAvatar
 * Deterministic blob-avatar derived from the user's name/email seed.
 * Same name → same shape, colour, and expression every time.
 * Falls back to a plain letter circle if name is empty.
 */

import { BlobAvatar } from "blob-avatar";

// Derive a 1-6 char alphanumeric seed from an arbitrary string.
function toSeed(input: string): string {
  const clean = input
    .toLowerCase()
    .replace(/[^0-9a-z]/g, "")
    .slice(0, 6);
  return clean.length > 0 ? clean : "abc";
}

// Pick a colour deterministically from the name (one of 12 friendly tones).
const PALETTE = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#84cc16", // lime
];

function pickColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length]!;
}

const SHAPES = [
  "circle",
  "pebble",
  "squircle",
  "capsule",
  "cloud",
  "amoeba",
  "flower",
  "bubble",
] as const;

function pickShape(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 17 + name.charCodeAt(i)) >>> 0;
  }
  return SHAPES[h % SHAPES.length]!;
}

type Props = {
  name: string;
  size?: number;
  /** Extra className on the wrapper span */
  className?: string;
};

export function UserAvatar({ name, size = 28, className }: Props) {
  const seed = toSeed(name || "user");
  const color = pickColor(name || "user");
  const shape = pickShape(name || "user");

  return (
    <BlobAvatar
      seed={seed}
      color={color}
      shape={shape}
      expression="happy"
      animation="idle.2.4,wink.1.6"
      size={size}
      reaction
      aria-label={`${name || "User"} avatar`}
      className={className}
    />
  );
}
