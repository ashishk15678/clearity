import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SignOutButton } from "./sign-out-button";
import { UserAvatar } from "@/components/user-avatar";

export const metadata = { title: "Settings · Clarity" };

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = session.user;
  const ingest_url = process.env.NEXT_PUBLIC_INGEST_URL;
  if (!ingest_url) {
    console.warn(
      "[clarity] NEXT_PUBLIC_INGEST_URL is not set — ingest endpoint display will be blank.",
    );
  }

  return (
    <div className="flex flex-col">
      <Topbar title="Settings" />
      <div className="flex-1 p-6 space-y-4 max-w-2xl">

        {/* Profile */}
        <Card>
          <CardHeader>
            <span className="text-[13px] font-semibold text-foreground">
              Profile
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <UserAvatar name={user.name ?? user.email ?? ""} size={48} />
              <div>
                <p className="text-[13px] font-semibold text-foreground">
                  {user.name}
                </p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingest endpoint */}
        <Card>
          <CardHeader>
            <span className="text-[13px] font-semibold text-foreground">
              Ingest Endpoint
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[12px] text-muted-foreground">
              Send tracking data to the Ingest service.
            </p>
            <div className="grid gap-2">
              {ingest_url ? (
                [
                  ["Track Event", `POST ${ingest_url}/track/event`],
                  ["Track Page View", `POST ${ingest_url}/track/pageview`],
                  ["Health", `GET ${ingest_url}/health`],
                  ["Event Report", `GET ${ingest_url}/reports/events?project_id=…`],
                  ["Pageview Report", `GET ${ingest_url}/reports/pageviews?project_id=…`],
                ].map(([label, url]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wide">
                      {label}
                    </span>
                    <code className="rounded-md border border-border bg-muted px-3 py-1.5 text-[11px] font-mono text-foreground break-all">
                      {url}
                    </code>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <p className="text-[12px] font-medium text-destructive">
                    NEXT_PUBLIC_INGEST_URL is not configured.
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Set it in <code className="font-mono">apps/web/.env</code>{" "}
                    and restart the server.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <span className="text-[13px] font-semibold text-destructive">
              Danger Zone
            </span>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-foreground">
                Sign out
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
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
