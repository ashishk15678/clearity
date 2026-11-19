export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-background px-5">
        <div className="h-4 w-20 rounded bg-muted" />
      </div>
      <div className="flex-1 p-6 space-y-8 max-w-4xl">
        {/* Current plan */}
        <div className="space-y-3">
          <div className="h-3.5 w-28 rounded bg-muted" />
          <div className="h-20 max-w-lg rounded-lg border border-border bg-muted" />
        </div>
        {/* Usage */}
        <div className="space-y-3">
          <div className="h-3.5 w-32 rounded bg-muted" />
          <div className="grid gap-3 sm:grid-cols-3 max-w-2xl">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg border border-border bg-muted" />
            ))}
          </div>
        </div>
        {/* Plans */}
        <div className="space-y-3">
          <div className="h-3.5 w-16 rounded bg-muted" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-lg border border-border bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
