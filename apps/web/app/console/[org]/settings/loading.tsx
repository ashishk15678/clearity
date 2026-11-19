export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="flex h-[52px] shrink-0 items-center border-b border-border bg-background px-5">
        <div className="h-4 w-20 rounded bg-muted" />
      </div>
      <div className="flex-1 p-6 space-y-4 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border p-5 space-y-3">
            <div className="h-3.5 w-24 rounded bg-muted" />
            <div className="h-10 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
