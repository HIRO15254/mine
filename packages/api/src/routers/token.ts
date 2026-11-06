import { apiToken } from "@mine/db/schema/token";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { browserProcedure, router } from "../index";
import { generateToken, hashToken, tokenPrefix } from "../tokens";

const columns = {
	createdAt: apiToken.createdAt,
	id: apiToken.id,
	lastUsedAt: apiToken.lastUsedAt,
	name: apiToken.name,
	prefix: apiToken.prefix,
};

export const tokenRouter = router({
	list: browserProcedure.query(({ ctx }) =>
		ctx.db
			.select(columns)
			.from(apiToken)
			.where(eq(apiToken.userId, ctx.session.user.id))
			.orderBy(desc(apiToken.createdAt))
	),

	/** Returns the token itself once; only its hash is kept. */
	create: browserProcedure
		.input(z.object({ name: z.string().trim().min(1).max(100) }))
		.mutation(async ({ ctx, input }) => {
			const token = generateToken();
			const row = {
				id: crypto.randomUUID(),
				name: input.name,
				prefix: tokenPrefix(token),
				tokenHash: await hashToken(token),
				userId: ctx.session.user.id,
			};
			await ctx.db.insert(apiToken).values(row);
			return { id: row.id, name: row.name, prefix: row.prefix, token };
		}),

	delete: browserProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const deleted = await ctx.db
				.delete(apiToken)
				.where(
					and(
						eq(apiToken.id, input.id),
						eq(apiToken.userId, ctx.session.user.id)
					)
				)
				.returning({ id: apiToken.id });
			if (deleted.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Token not found" });
			}
			return { id: input.id };
		}),
});
