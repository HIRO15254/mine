import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { protectedProcedure, publicProcedure, router } from "../index";
import { calendarRouter } from "./calendar";
import { labelRouter } from "./label";
import { projectRouter } from "./project";
import { taskRouter } from "./task";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK" as const),
	me: protectedProcedure.query(({ ctx }) => ctx.session.user),
	calendar: calendarRouter,
	label: labelRouter,
	project: projectRouter,
	task: taskRouter,
});

export type AppRouter = typeof appRouter;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
