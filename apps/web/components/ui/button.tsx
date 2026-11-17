import { cn } from "@/lib/cn";

// ─── Single button design system ─────────────────────────────────────────────
//
// One visual language across the whole app:
//   - Flat surface, 1px border, micro shadow on primary
//   - Only px/h change between sizes — color, radius, weight stay constant
//   - All interactive states (hover, active, focus-visible, disabled) defined here
//
// Never pass raw Tailwind colour classes to override — use variant + size only.

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

// Base — shared across all variants
const BASE =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg " +
  "transition-all duration-150 select-none whitespace-nowrap " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
  "disabled:pointer-events-none disabled:opacity-40 " +
  "active:scale-[0.98]";

const VARIANTS: Record<ButtonVariant, string> = {
  // ── Primary ───────────────────────────────────────────────────────────────
  // Vercel-style: deep blue fill, white text, shadow lifts on hover
  primary:
    "bg-primary text-primary-foreground border border-primary " +
    "shadow-[0_1px_3px_0_rgb(0_112_243/0.3),inset_0_1px_0_0_rgb(255_255_255/0.08)] " +
    "hover:bg-primary/90 hover:shadow-[0_2px_6px_0_rgb(0_112_243/0.4)] " +
    "active:bg-primary/80",

  // ── Secondary ─────────────────────────────────────────────────────────────
  // Neutral fill with hairline border — the default
  secondary:
    "bg-secondary text-secondary-foreground border border-border " +
    "shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] " +
    "hover:bg-muted hover:border-border/80 " +
    "active:bg-muted/80",

  // ── Ghost ─────────────────────────────────────────────────────────────────
  // No border, no shadow — for toolbars and icon buttons
  ghost:
    "bg-transparent text-muted-foreground border border-transparent " +
    "hover:bg-accent hover:text-accent-foreground " +
    "active:bg-accent/80",

  // ── Danger ────────────────────────────────────────────────────────────────
  // Red fill — same construction as primary
  danger:
    "bg-destructive text-destructive-foreground border border-destructive " +
    "shadow-[0_1px_3px_0_rgb(220_0_0/0.25),inset_0_1px_0_0_rgb(255_255_255/0.08)] " +
    "hover:bg-destructive/90 hover:shadow-[0_2px_6px_0_rgb(220_0_0/0.3)] " +
    "active:bg-destructive/80",

  // ── Outline ───────────────────────────────────────────────────────────────
  // Transparent fill, visible border — lower hierarchy than secondary
  outline:
    "bg-transparent text-foreground border border-border " +
    "hover:bg-accent hover:text-accent-foreground " +
    "active:bg-accent/80",
};

const SIZES: Record<ButtonSize, string> = {
  icon: "h-8 w-8 p-0 text-sm", // square icon button
  sm: "h-7 px-2.5 text-xs", // compact — table actions, badges
  md: "h-8 px-3.5 text-sm", // default
  lg: "h-9 px-5 text-sm font-semibold", // primary CTA
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      {...props}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {children}
    </button>
  );
}
