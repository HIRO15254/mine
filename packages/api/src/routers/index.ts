import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { protectedProcedure, publicProcedure, router } from "../index";
import { calendarRouter } from "./calendar";
import { labelRouter } from "./label";
import { projectRouter } from "./project";
import { rateRouter } from "./rate";
import { taskRouter } from "./task";
import { timeRouter } from "./time";
import { tokenRouter } from "./token";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK" as const),
	me: protectedProcedure.query(({ ctx }) => ctx.session.user),
	calendar: calendarRouter,
	label: labelRouter,
	project: projectRouter,
	rate: rateRouter,
	task: taskRouter,
	time: timeRouter,
	token: tokenRouter,
});

export type AppRouter = typeof appRouter;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
