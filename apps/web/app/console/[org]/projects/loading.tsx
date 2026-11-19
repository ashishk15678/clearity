// Suspense boundary for the projects list page.
export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse">
      {/* Topbar */}
      <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-background px-5">
        <div className="h-4 w-20 rounded bg-muted" />
      </div>

      <div className="flex-1 p-6">
        {/* Header row */}
        <div className="mb-6 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
          <div className="h-9 w-28 rounded-md bg-muted" />
        </div>

        {/* Card grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-md bg-muted" />
                <div className="space-y-1 flex-1">
                  <div className="h-3.5 w-2/3 rounded bg-muted" />
                  <div className="h-2.5 w-1/3 rounded bg-muted" />
                </div>
              </div>
              <div className="h-2.5 w-full rounded bg-muted pl-10" />
              <div className="flex gap-3 pl-10">
                <div className="h-2.5 w-14 rounded bg-muted" />
                <div className="h-2.5 w-14 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
