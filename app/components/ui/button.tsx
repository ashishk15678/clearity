import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-linear-to-b from-indigo-400 to-indigo-600  text-white hover:bg-indigo-700 focus-visible:outline-indigo-600 disabled:opacity-50",
  outline: "focus-visible:outline-indigo-600 disabled:opacity-50",

  secondary:
    "bg-linear-to-b from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 text-zinc-700 dark:text-zinc-300  hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50",
  ghost:
    "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50",
  danger:
    "bg-linear-to-b from-red-500 to-red-700 text-white hover:bg-red-500 focus-visible:outline-red-600 disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs rounded-md",
  md: "h-8 px-3.5 text-sm rounded-lg",
  lg: "h-8 px-8 text-sm rounded-lg",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 duration-200",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
