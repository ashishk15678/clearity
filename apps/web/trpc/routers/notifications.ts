import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";

export const notificationsRouter = createTRPCRouter({
  /** Most-recent 50 notifications for the current user. */
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      return prisma.notification.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
      });
    }),

  /** Count of unread notifications — cheap poll for the bell badge. */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return prisma.notification.count({
      where: { userId: ctx.user.id, read: false },
    });
  }),

  /** Mark a single notification as read. */
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.notification.updateMany({
        where: { id: input.id, userId: ctx.user.id },
        data: { read: true },
      });
      return { success: true };
    }),

  /** Mark all notifications read. */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.notification.updateMany({
      where: { userId: ctx.user.id, read: false },
      data: { read: true },
    });
    return { success: true };
  }),
});

// ── Helper — emit a notification from server-side mutations ──────────────────
//
// import { emitNotification } from "@/trpc/routers/notifications";
// await emitNotification(userId, "invite_received", "You have an invite", body, link);

export async function emitNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string,
) {
  const { createId } = await import("@paralleldrive/cuid2").catch(() => ({
    createId: () => `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  }));
  await prisma.notification.create({
    data: {
      id: typeof createId === "function" ? createId() : `notif_${Date.now()}`,
      userId,
      type,
      title,
      body,
      link: link ?? null,
    },
  });
}
