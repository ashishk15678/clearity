// Suspense boundary for the project detail page.
export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse">
      {/* Topbar */}
      <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-background px-5 gap-2">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-5 w-20 rounded bg-muted" />
      </div>

      {/* Project header */}
      <div className="bg-background px-5 sm:px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-56 rounded bg-muted" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-14 rounded-md border border-border bg-muted" />
            ))}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border px-5 sm:px-6 flex gap-1">
        {[80, 70, 55, 55, 65, 75, 60, 50].map((w, i) => (
          <div key={i} className="my-2.5 rounded" style={{ height: 20, width: w, background: "var(--muted)" }} />
        ))}
      </div>

      {/* KPI cards */}
      <div className="px-5 sm:px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg border border-border bg-muted" />
          ))}
        </div>
        {/* Table rows */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
