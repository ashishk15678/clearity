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
      <div className="flex-1 p-6 space-y-8">
        {/* Current plan */}
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Current Plan
          </h2>
          <Card className="max-w-lg">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    Hobby
                  </span>
                  <Badge variant="success">Active</Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Free forever — no credit card required.
                </p>
              </div>
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                $0
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Usage */}
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Usage This Cycle
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 max-w-2xl">
            <UsageBar label="Events" used={0} limit={100_000} />
            <UsageBar label="Page Views" used={0} limit={500_000} />
            <UsageBar label="Projects" used={0} limit={3} />
          </div>
        </div>

        {/* Plans */}
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Plans
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.current
                    ? "border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-300 dark:ring-indigo-700"
                    : ""
                }
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {plan.name}
                    </span>
                    {plan.current && <Badge variant="default">Current</Badge>}
                  </div>
                  <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {plan.price}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <li className="flex justify-between">
                      <span>Events / mo</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-200">
                        {plan.events}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Page views / mo</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-200">
                        {plan.pageViews}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Projects</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-200">
                        {plan.projects}
                      </span>
                    </li>
                  </ul>
                  {!plan.current && (
                    <button
                      disabled
                      className="mt-4 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
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
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-zinc-500">{label}</span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {used.toLocaleString()} / {limit.toLocaleString()}
          </span>
        </div>
        <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-zinc-400">{pct.toFixed(0)}% used</p>
      </CardContent>
    </Card>
  );
}
