export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-background px-6">
        <div className="h-3.5 w-20 rounded-md bg-muted" />
      </div>
      <div className="flex-1 p-6 max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-24 rounded-lg bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
          <div className="h-9 w-28 rounded-lg bg-muted" />
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="h-9 bg-muted/40 border-b border-border" />
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_72px_72px_64px_36px] items-center gap-3 px-4 py-3.5 border-b last:border-0 border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-muted" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-28 rounded bg-muted" />
                  <div className="h-2.5 w-20 rounded bg-muted" />
                </div>
              </div>
              <div className="hidden sm:block h-3 w-10 rounded bg-muted ml-auto" />
              <div className="hidden sm:block h-3 w-10 rounded bg-muted ml-auto" />
              <div className="hidden sm:block h-3 w-6 rounded bg-muted ml-auto" />
              <div />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
