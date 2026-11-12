import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const authRouter = createTRPCRouter({
  /**
   * Get the current session + user.
   * Returns null when not logged in.
   */
  getSession: baseProcedure.query(async () => {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    return session ?? null;
  }),

  /**
   * Sign up with email + password.
   */
  signUp: baseProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sign up failed",
        });
      }

      return { success: true };
    }),

  /**
   * Sign in with email + password.
   */
  signIn: baseProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email"),
        password: z.string().min(1, "Password is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await auth.api.signInEmail({
        body: {
          email: input.email,
          password: input.password,
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      return { success: true };
    }),

  /**
   * Sign out the current user.
   */
  signOut: protectedProcedure.mutation(async () => {
    const headersList = await headers();
    await auth.api.signOut({ headers: headersList });
    return { success: true };
  }),

  /**
   * Get the current user's profile (requires auth).
   */
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.user;
  }),
});
