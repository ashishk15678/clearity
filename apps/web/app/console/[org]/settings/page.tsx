import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/dashboard/topbar";
import { SignOutButton } from "./sign-out-button";
import { UserAvatar } from "@/components/user-avatar";

export const metadata = { title: "Settings · Clarity" };

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = session.user;
  const ingest_url = process.env.NEXT_PUBLIC_INGEST_URL;
  if (!ingest_url) {
    console.warn("[clarity] NEXT_PUBLIC_INGEST_URL is not set — ingest endpoint display will be blank.");
  }

  const endpoints = ingest_url
    ? [
        ["Track Event", "POST", `${ingest_url}/track/event`],
        ["Track Page View", "POST", `${ingest_url}/track/pageview`],
        ["Health", "GET", `${ingest_url}/health`],
        ["Event Report", "GET", `${ingest_url}/reports/events?project_id=…`],
        ["Pageview Report", "GET", `${ingest_url}/reports/pageviews?project_id=…`],
      ]
    : null;

  return (
    <div className="flex flex-col">
      <Topbar title="Settings" />

      <div className="flex-1 p-6 space-y-6 max-w-2xl">

        {/* Profile card */}
        <Section title="Profile">
          <div className="flex items-center gap-4 p-4">
            <UserAvatar name={user.name ?? user.email ?? ""} size={44} />
            <div>
              <p className="text-[14px] font-semibold text-foreground leading-none">
                {user.name}
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">{user.email}</p>
            </div>
          </div>
        </Section>

        {/* Ingest endpoints */}
        <Section title="Ingest Endpoint">
          <p className="text-[12px] text-muted-foreground px-4 pt-3 pb-2">
            The Ingest service handles all SDK event tracking.
          </p>
          {endpoints ? (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Route</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Method</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">URL</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map(([label, method, url]) => (
                  <tr key={label} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{label}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        method === "POST"
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {method}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground break-all">{url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="mx-4 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-[12px] font-semibold text-destructive">NEXT_PUBLIC_INGEST_URL is not configured</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Set it in <code className="font-mono">apps/web/.env</code> and restart the server.
              </p>
            </div>
          )}
        </Section>

        {/* Danger zone */}
        <Section title="Danger Zone" danger>
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-[13px] font-medium text-foreground">Sign out</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                You&apos;ll need to sign in again to access your dashboard.
              </p>
            </div>
            <SignOutButton />
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({
  title,
  children,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-xl border overflow-hidden ${danger ? "border-destructive/30" : "border-border"}`}>
      <div className={`px-4 py-3 border-b ${danger ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/40"}`}>
        <p className={`text-[12px] font-semibold uppercase tracking-widest ${danger ? "text-destructive" : "text-muted-foreground"}`}>
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}
