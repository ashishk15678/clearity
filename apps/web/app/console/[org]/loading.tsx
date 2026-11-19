// Streamed Suspense boundary for the org overview page.
// Mirrors the topbar + stat strip + project list skeleton.
export default function Loading() {
  return (
    <div className="flex flex-col min-h-0 animate-pulse">
      {/* Topbar */}
      <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-background px-5">
        <div className="h-4 w-24 rounded bg-muted" />
      </div>

      <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-8">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted" />
          </div>
          <div className="h-8 w-28 rounded-md bg-muted" />
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card px-4 py-3.5 space-y-2">
              <div className="h-2.5 w-14 rounded bg-muted" />
              <div className="h-6 w-10 rounded bg-muted" />
              <div className="h-2 w-8 rounded bg-muted" />
            </div>
          ))}
        </div>

        {/* Recent projects */}
        <div className="space-y-3">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="rounded-lg border border-border overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-md bg-muted" />
                  <div className="space-y-1">
                    <div className="h-3 w-28 rounded bg-muted" />
                    <div className="h-2.5 w-20 rounded bg-muted" />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-3 w-14 rounded bg-muted" />
                  <div className="h-3 w-14 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
