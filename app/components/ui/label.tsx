import { cn } from "@/lib/cn";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn(
        "block text-sm font-medium text-zinc-700 dark:text-zinc-300",
        className,
      )}
    />
  );
}
