import { protectedProcedure, publicProcedure, router } from "../index";
import { calendarRouter } from "./calendar";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK" as const),
	me: protectedProcedure.query(({ ctx }) => ctx.session.user),
	calendar: calendarRouter,
});

export type AppRouter = typeof appRouter;
