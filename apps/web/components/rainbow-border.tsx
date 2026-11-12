"use client";

import React from "react";

interface RainbowBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Border radius of the container (e.g., "9999px" for pills, "0.75rem" for cards) */
  borderRadius?: string;
  /** Thickness of the sharp outer border in px (default: 1) */
  borderWidth?: number;
  /** Speed of the organic cubic-bezier movement in seconds (default: 9) */
  duration?: number;
  /** Intensity of the soft inward rainbow aurora bleed from 0 to 1 (default: 0.42) */
  bleedOpacity?: number;
  /** Intensity of the sharp 1px rainbow border edge from 0 to 1 (default: 0.85) */
  edgeOpacity?: number;
  /** Make wrapper fit-content instead of full width */
  inline?: boolean;
  /** Optional class for the inner child container */
  innerClassName?: string;
}

export function RainbowBorder({
  children,
  borderRadius = "9999px",
  borderWidth = 1,
  duration = 9,
  bleedOpacity = 0.42,
  edgeOpacity = 0.85,
  inline = false,
  className = "",
  innerClassName = "",
  style,
  ...props
}: RainbowBorderProps) {
  return (
    <div
      className={`relative ${inline ? "inline-flex" : "flex"} group overflow-hidden p-[1px] ${className}`}
      style={{
        borderRadius,
        ...style,
      }}
      {...props}
    >
      <style>{`
        /* Moves the slanted prism spotlight organically around all edges & corners */
        @keyframes prism-roam {
          0% {
            transform: translate3d(-18%, 22%, 0) rotate(-14deg) scale(1);
            animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
          }
          23% {
            transform: translate3d(24%, 18%, 0) rotate(12deg) scale(1.08, 0.94);
            animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
          }
          48% {
            transform: translate3d(16%, -22%, 0) rotate(-8deg) scale(0.95, 1.06);
            animation-timing-function: cubic-bezier(0.76, 0, 0.24, 1);
          }
          74% {
            transform: translate3d(-24%, -14%, 0) rotate(16deg) scale(1.05);
            animation-timing-function: cubic-bezier(0.34, 1.4, 0.64, 1);
          }
          100% {
            transform: translate3d(-18%, 22%, 0) rotate(-14deg) scale(1);
          }
        }

        /* Secondary counter-drift so the rainbow bands shimmer internally */
        @keyframes prism-band-shift {
          0%, 100% {
            background-position: 50% 50%;
          }
          38% {
            background-position: 62% 45%;
          }
          71% {
            background-position: 38% 55%;
          }
        }
      `}</style>

      {/* 1. Quiet Base Hairline Border (Visible where the rainbow isn't present) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/[0.08]"
      />

      {/* 2. Sharp 1px Specular Rainbow Edge (Masked exclusively to the 1px perimeter) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] transition-opacity duration-500"
        style={{
          padding: `${borderWidth}px`,
          opacity: edgeOpacity,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      >
        <div
          className="h-full w-full"
          style={{
            // Slanted localized spectrum with transparent flanks (matches screenshot)
            backgroundImage: `linear-gradient(
              112deg,
              transparent 24%,
              rgba(139, 92, 246, 0.85) 36%,
              rgba(163, 230, 53, 0.9) 43%,
              rgba(255, 110, 165, 1) 50%,
              rgba(56, 189, 248, 0.95) 57%,
              rgba(168, 85, 247, 0.8) 64%,
              transparent 76%
            )`,
            backgroundSize: "220% 220%",
            // Radial mask keeps it localized as a traveling patch along the edge
            WebkitMaskImage:
              "radial-gradient(ellipse 45% 90% at 50% 85%, black 15%, transparent 72%)",
            maskImage:
              "radial-gradient(ellipse 45% 90% at 50% 85%, black 15%, transparent 72%)",
            animation: `
              prism-roam ${duration}s infinite,
              prism-band-shift ${Math.round(duration * 0.75)}s ease-in-out infinite
            `,
          }}
        />
      </div>

      {/* 3. Soft Inward Aurora Bleed (Illuminates the inside surface near the active border) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
      >
        <div
          className="h-full w-full blur-[16px] transition-opacity duration-500 group-hover:opacity-65"
          style={{
            opacity: bleedOpacity,
            backgroundImage: `linear-gradient(
              112deg,
              transparent 26%,
              rgba(139, 92, 246, 0.65) 37%,
              rgba(163, 230, 53, 0.75) 44%,
              rgba(251, 113, 133, 0.9) 50%,
              rgba(56, 189, 248, 0.8) 56%,
              rgba(168, 85, 247, 0.65) 63%,
              transparent 74%
            )`,
            backgroundSize: "220% 220%",
            WebkitMaskImage:
              "radial-gradient(ellipse 42% 85% at 50% 80%, black 10%, transparent 70%)",
            maskImage:
              "radial-gradient(ellipse 42% 85% at 50% 80%, black 10%, transparent 70%)",
            animation: `
              prism-roam ${duration}s infinite,
              prism-band-shift ${Math.round(duration * 0.75)}s linear infinite
            `,
          }}
        />
      </div>

      {/* 4. Child Content Container */}
      <div
        className={`relative z-10 w-full bg-[#161618]/90 backdrop-blur-md ${innerClassName}`}
        style={{
          borderRadius: `calc(${borderRadius} - ${borderWidth}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
