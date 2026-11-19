export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-background px-5">
        <div className="h-4 w-20 rounded bg-muted" />
      </div>
      <div className="flex-1 p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex gap-3">
          <div className="h-8 w-36 rounded-md bg-muted" />
          <div className="h-8 w-28 rounded-md bg-muted" />
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg border border-border bg-muted" />
          ))}
        </div>
        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-48 rounded-lg border border-border bg-muted" />
          <div className="h-48 rounded-lg border border-border bg-muted" />
        </div>
      </div>
    </div>
  );
}
