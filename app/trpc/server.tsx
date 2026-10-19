import "server-only";

import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { cache } from "react";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";
import type { AppRouter } from "./routers/_app";

// Stable per-request query client
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy<AppRouter>({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

/** Wrap a server component subtree so dehydrated queries hydrate on the client. */
export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
