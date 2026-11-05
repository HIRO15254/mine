import { protectedProcedure, publicProcedure, router } from "../index";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK" as const),
	me: protectedProcedure.query(({ ctx }) => ctx.session.user),
});

export type AppRouter = typeof appRouter;
