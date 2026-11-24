import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Billing · Clarity" };

const PLANS = [
  {
    name: "Hobby",
    price: "Free",
    unit: "forever",
    events: "100K",
    pageViews: "500K",
    projects: "3",
    current: true,
    cta: null,
  },
  {
    name: "Pro",
    price: "$19",
    unit: "/ month",
    events: "5M",
    pageViews: "25M",
    projects: "Unlimited",
    current: false,
    cta: "Upgrade to Pro",
  },
  {
    name: "Enterprise",
    price: "Custom",
    unit: "",
    events: "Unlimited",
    pageViews: "Unlimited",
    projects: "Unlimited",
    current: false,
    cta: "Contact sales",
  },
];

export default function BillingPage() {
  return (
    <div className="flex flex-col">
      <Topbar title="Billing" />
      <div className="flex-1 p-6 max-w-4xl space-y-8">

        {/* Current plan */}
        <div>
          <SectionTitle>Current plan</SectionTitle>
          <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4 max-w-lg">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold text-foreground">Hobby</span>
                <Badge variant="success">Active</Badge>
              </div>
              <p className="text-[12px] text-muted-foreground">Free forever — no credit card required.</p>
            </div>
            <span className="text-3xl font-bold text-foreground tabular-nums">$0</span>
          </div>
        </div>

        {/* Usage bars */}
        <div>
          <SectionTitle>Usage this cycle</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 max-w-2xl">
            <UsageBar label="Events" used={0} limit={100_000} limitLabel="100K" />
            <UsageBar label="Page Views" used={0} limit={500_000} limitLabel="500K" />
            <UsageBar label="Projects" used={0} limit={3} limitLabel="3" />
          </div>
        </div>

        {/* Plan comparison table */}
        <div>
          <SectionTitle>Plans</SectionTitle>
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-border">
              <div className="px-5 py-3 bg-muted/40" />
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  className={`px-4 py-3 text-center border-l border-border ${p.current ? "bg-primary/5" : "bg-muted/40"}`}
                >
                  <p className="text-[12px] font-semibold text-foreground">{p.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    <span className="text-[15px] font-bold text-foreground">{p.price}</span>
                    {p.unit && <span className="ml-0.5">{p.unit}</span>}
                  </p>
                </div>
              ))}
            </div>

            {/* Rows */}
            {[
              { label: "Events / mo", key: "events" as const },
              { label: "Page views / mo", key: "pageViews" as const },
              { label: "Projects", key: "projects" as const },
            ].map((row) => (
              <div key={row.label} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-border last:border-0">
                <div className="px-5 py-3 text-[12px] font-medium text-muted-foreground bg-card">{row.label}</div>
                {PLANS.map((p) => (
                  <div
                    key={p.name}
                    className={`px-4 py-3 text-center text-[13px] font-semibold tabular-nums text-foreground border-l border-border ${p.current ? "bg-primary/5" : "bg-card"}`}
                  >
                    {p[row.key]}
                  </div>
                ))}
              </div>
            ))}

            {/* CTA row */}
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] bg-muted/20">
              <div className="px-5 py-3 bg-card" />
              {PLANS.map((p) => (
                <div key={p.name} className={`px-4 py-3 border-l border-border flex items-center justify-center ${p.current ? "bg-primary/5" : "bg-card"}`}>
                  {p.current ? (
                    <span className="text-[11px] font-semibold text-primary">Current</span>
                  ) : (
                    <button
                      disabled
                      className="rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {p.cta}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </h2>
  );
}

function UsageBar({ label, used, limit, limitLabel }: {
  label: string;
  used: number;
  limit: number;
  limitLabel: string;
}) {
  const pct = Math.min((used / limit) * 100, 100);
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums font-mono">
          {used.toLocaleString()} / {limitLabel}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">{pct.toFixed(0)}% used</p>
    </div>
  );
}
