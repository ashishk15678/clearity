"use client";

import React from "react";

export interface BorderBeamProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Size or width of the traveling beam ("line" | "sm" | "md" | "lg" or custom number) */
  size?: "line" | "sm" | "md" | "lg" | number;
  /** Color theme of the beam */
  colorVariant?: "colorful" | "subtle" | "ocean" | "sunset";
  /** Speed of one full loop in seconds (default: 4) */
  duration?: number;
  /** Border radius in px or CSS string (default: 20) */
  borderRadius?: number | string;
  /** Thickness of the sharp border line in px (default: 1) */
  borderWidth?: number;
  /** Intensity of the inward soft aurora mist from 0 to 1 (default: 0.55) */
  mistOpacity?: number;
  /** Add a second opposite-side beam (default: false) */
  dualBeam?: boolean;
}

const COLOR_VARIANTS: Record<
  NonNullable<BorderBeamProps["colorVariant"]>,
  string
> = {
  colorful: `linear-gradient(
    112deg,
    transparent 12%,
    rgba(139, 92, 246, 0.85) 28%,
    rgba(163, 230, 53, 0.95) 40%,
    rgba(255, 105, 165, 1) 50%,
    rgba(56, 189, 248, 0.95) 60%,
    rgba(168, 85, 247, 0.85) 72%,
    transparent 88%
  )`,
  subtle: `linear-gradient(
    112deg,
    transparent 15%,
    rgba(168, 85, 247, 0.5) 35%,
    rgba(244, 114, 182, 0.65) 50%,
    rgba(56, 189, 248, 0.5) 65%,
    transparent 85%
  )`,
  ocean: `linear-gradient(
    112deg,
    transparent 15%,
    #06b6d4 35%,
    #3b82f6 50%,
    #8b5cf6 65%,
    transparent 85%
  )`,
  sunset: `linear-gradient(
    112deg,
    transparent 15%,
    #f59e0b 35%,
    #ec4899 50%,
    #8b5cf6 65%,
    transparent 85%
  )`,
};

export function BorderBeam({
  children,
  size = "md",
  colorVariant = "colorful",
  duration = 4,
  borderRadius = 1,
  borderWidth = 1,
  mistOpacity = 0.55,
  dualBeam = false,
  style,
  className = "",
  ...props
}: BorderBeamProps) {
  const radiusValue =
    typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;

  const beamWidth =
    typeof size === "number"
      ? size
      : size === "line"
        ? 180
        : size === "sm"
          ? 220
          : size === "md"
            ? 280
            : 360;

  const gradient = COLOR_VARIANTS[colorVariant] || COLOR_VARIANTS.colorful;

  const getTravelerStyle = (
    isGlowLayer: boolean,
    delaySeconds = 0,
  ): React.CSSProperties => ({
    position: "absolute",
    // Restrict positioning to bottom edge
    bottom: 0,
    left: 0,
    width: `${beamWidth}px`,
    height: isGlowLayer ? "64px" : `${Math.max(beamWidth * 0.45, 40)}px`,
    background: gradient,
    borderRadius: "9999px",
    filter: isGlowLayer ? "blur(18px)" : "none",
    opacity: isGlowLayer ? mistOpacity : 1,
    WebkitMaskImage:
      "radial-gradient(ellipse 65% 65% at 50% 50%, #000 30%, transparent 100%)",
    maskImage:
      "radial-gradient(ellipse 65% 65% at 50% 50%, #000 30%, transparent 100%)",
    animation: `border-beam-bottom-only ${duration}s ease-in-out infinite alternate`,
    animationDelay: `${delaySeconds}s`,
    willChange: "transform",
    pointerEvents: "none",
  });

  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        borderRadius: radiusValue,
        overflow: "hidden",
        ...style,
      }}
      {...props}
    >
      <style>{`
        /* Smooth translation back and forth along the bottom edge only */
        @keyframes border-beam-bottom-only {
          0% {
            transform: translateX(-15%) skewX(-14deg);
          }
          100% {
            transform: translateX(115%) skewX(-14deg);
          }
        }
      `}</style>

      {/* 1. Child Component */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          borderRadius: radiusValue,
          width: "100%",
          height: "100%",
        }}
      >
        {children}
      </div>

      {/* 2. Soft Inward Aurora Mist (Bottom Only) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radiusValue,
          pointerEvents: "none",
          zIndex: 2,
          overflow: "hidden",
          mixBlendMode: "screen",
        }}
      >
        <div style={getTravelerStyle(true, 0)} />
        {dualBeam && <div style={getTravelerStyle(true, -duration / 2)} />}
      </div>

      {/* 3. Razor-Sharp 1px Border Ring (Bottom Only) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radiusValue,
          padding: `${borderWidth}px`,
          pointerEvents: "none",
          zIndex: 3,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      >
        <div style={getTravelerStyle(false, 0)} />
        {dualBeam && <div style={getTravelerStyle(false, -duration / 2)} />}
      </div>
    </div>
  );
}
