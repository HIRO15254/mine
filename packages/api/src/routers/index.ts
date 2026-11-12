import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { protectedProcedure, publicProcedure, router } from "../index";
import { calendarRouter } from "./calendar";
import { labelRouter } from "./label";
import { oauthRouter } from "./oauth";
import { projectRouter } from "./project";
import { rateRouter } from "./rate";
import { taskRouter } from "./task";
import { threadRouter } from "./thread";
import { timeRouter } from "./time";
import { tokenRouter } from "./token";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK" as const),
	me: protectedProcedure.query(({ ctx }) => ctx.session.user),
	calendar: calendarRouter,
	label: labelRouter,
	oauth: oauthRouter,
	project: projectRouter,
	rate: rateRouter,
	task: taskRouter,
	thread: threadRouter,
	time: timeRouter,
	token: tokenRouter,
});

export type AppRouter = typeof appRouter;
/** The procedures as plain functions, for one signed-in user. */
export type Caller = ReturnType<typeof appRouter.createCaller>;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
