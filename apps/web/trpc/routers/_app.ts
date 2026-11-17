import { createTRPCRouter } from "@/trpc/init";
import { authRouter } from "./auth";
import { projectsRouter } from "./projects";
import { eventsRouter } from "./events";
import { reportsRouter } from "./reports";
import { sessionsRouter } from "./sessions";
import { errorsRouter } from "./errors";
import { OrgRouter } from "./orgs";
import { notificationsRouter } from "./notifications";

export const appRouter = createTRPCRouter({
  auth:          authRouter,
  projects:      projectsRouter,
  events:        eventsRouter,
  reports:       reportsRouter,
  sessions:      sessionsRouter,
  errors:        errorsRouter,
  org:           OrgRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
