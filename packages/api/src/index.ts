import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

// Workers have no NODE_ENV, so tRPC would treat production as development
// and put stack traces in every error response.
export const t = initTRPC.context<Context>().create({ isDev: false });
export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	const session = await ctx.resolveSession();
	if (!session) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({ ctx: { ...ctx, session } });
});

/** Signed in through the browser, not with any token (e.g. token admin). */
export const browserProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (ctx.session.via) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "API tokens cannot manage tokens",
		});
	}
	return next();
});
