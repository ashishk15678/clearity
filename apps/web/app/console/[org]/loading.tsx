export default function Loading() {
  return (
    <div className="flex flex-col min-h-0 animate-pulse">
      <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-background px-6">
        <div className="h-3.5 w-24 rounded-md bg-muted" />
      </div>
      <div className="mx-auto max-w-5xl w-full px-6 py-8 space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-36 rounded-lg bg-muted" />
              <div className="h-5 w-14 rounded-full bg-muted" />
            </div>
            <div className="h-3 w-56 rounded-md bg-muted" />
          </div>
          <div className="h-9 w-28 rounded-lg bg-muted" />
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="h-2.5 w-16 rounded bg-muted" />
              <div className="h-7 w-12 rounded bg-muted" />
              <div className="h-2 w-10 rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* Projects */}
        <div className="space-y-3">
          <div className="h-4 w-28 rounded-md bg-muted" />
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="h-9 bg-muted/40 border-b border-border" />
            {[1,2,3,4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b last:border-0 border-border bg-card">
                <div className="h-7 w-7 rounded-lg bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-28 rounded bg-muted" />
                  <div className="h-2.5 w-20 rounded bg-muted" />
                </div>
                <div className="h-3 w-10 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
