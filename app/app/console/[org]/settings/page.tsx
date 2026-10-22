import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SignOutButton } from "./sign-out-button";

// export const instant = false;
export const metadata = { title: "Settings · Clarity" };

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = session.user;

  return (
    <div className="flex flex-col">
      <Topbar title="Settings" />
      <div className="flex-1 p-6 space-y-6 max-w-2xl">
        {/* Profile */}
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Profile
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
                {user.name?.[0]?.toUpperCase() ?? "?"}
              </span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {user.name}
                </p>
                <p className="text-sm text-zinc-500">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingest endpoint */}
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Ingest Endpoint
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Send tracking data to the Ingest service. It runs on port 4000 by
              default.
            </p>
            <div className="grid gap-2 text-sm">
              {[
                ["Track Event", "POST http://localhost:4000/track/event"],
                [
                  "Track Page View",
                  "POST http://localhost:4000/track/pageview",
                ],
                ["Health", "GET http://localhost:4000/health"],
                [
                  "Event Report",
                  "GET http://localhost:4000/reports/events?project_id=…",
                ],
                [
                  "Pageview Report",
                  "GET http://localhost:4000/reports/pageviews?project_id=…",
                ],
              ].map(([label, url]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-xs text-zinc-400">{label}</span>
                  <code className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-700 dark:text-zinc-300 break-all">
                    {url}
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
              Danger Zone
            </span>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Sign out
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                You&apos;ll need to sign in again to access your dashboard.
              </p>
            </div>
            <SignOutButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
