import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Billing · Clarity" };

const PLANS = [
  {
    name: "Hobby",
    price: "Free",
    events: "100K",
    pageViews: "500K",
    projects: "3",
    current: true,
  },
  {
    name: "Pro",
    price: "$19/mo",
    events: "5M",
    pageViews: "25M",
    projects: "Unlimited",
    current: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    events: "Unlimited",
    pageViews: "Unlimited",
    projects: "Unlimited",
    current: false,
  },
];

export default function BillingPage() {
  return (
    <div className="flex flex-col">
      <Topbar title="Billing" />
      <div className="flex-1 p-6 space-y-8 max-w-4xl">

        {/* Current plan */}
        <div>
          <h2 className="text-[13px] font-semibold text-foreground mb-3">
            Current Plan
          </h2>
          <Card className="max-w-lg">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-foreground">
                    Hobby
                  </span>
                  <Badge variant="success">Active</Badge>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Free forever — no credit card required.
                </p>
              </div>
              <span className="text-[22px] font-bold text-foreground tabular-nums">
                $0
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Usage */}
        <div>
          <h2 className="text-[13px] font-semibold text-foreground mb-3">
            Usage This Cycle
          </h2>
          <div className="grid gap-3 sm:grid-cols-3 max-w-2xl">
            <UsageBar label="Events" used={0} limit={100_000} />
            <UsageBar label="Page Views" used={0} limit={500_000} />
            <UsageBar label="Projects" used={0} limit={3} />
          </div>
        </div>

        {/* Plans */}
        <div>
          <h2 className="text-[13px] font-semibold text-foreground mb-3">
            Plans
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.current
                    ? "border-primary/40 ring-1 ring-primary/30"
                    : ""
                }
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-foreground">
                      {plan.name}
                    </span>
                    {plan.current && <Badge variant="default">Current</Badge>}
                  </div>
                  <p className="mt-1 text-[22px] font-bold text-foreground tabular-nums">
                    {plan.price}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-[12px] text-muted-foreground">
                    <li className="flex justify-between">
                      <span>Events / mo</span>
                      <span className="font-semibold text-foreground">
                        {plan.events}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Page views / mo</span>
                      <span className="font-semibold text-foreground">
                        {plan.pageViews}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Projects</span>
                      <span className="font-semibold text-foreground">
                        {plan.projects}
                      </span>
                    </li>
                  </ul>
                  {!plan.current && (
                    <button
                      disabled
                      className="mt-4 w-full rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {plan.name === "Enterprise" ? "Contact us" : "Upgrade"}
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const pct = Math.min((used / limit) * 100, 100);
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-muted-foreground font-medium">{label}</span>
          <span className="font-semibold text-foreground tabular-nums">
            {used.toLocaleString()} / {limit.toLocaleString()}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {pct.toFixed(0)}% used
        </p>
      </CardContent>
    </Card>
  );
}
