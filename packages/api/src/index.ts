import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	const session = await ctx.resolveSession();
	if (!session) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({ ctx: { ...ctx, session } });
});

/** Signed in through the browser, not with an API token (e.g. token admin). */
export const browserProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (ctx.session.via === "token") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "API tokens cannot manage tokens",
		});
	}
	return next();
});
