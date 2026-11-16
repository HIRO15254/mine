import { widgetToken } from "@mine/db/schema/token";
import { eq } from "drizzle-orm";

import { browserProcedure, router } from "../index";
import {
	generateToken,
	hashToken,
	tokenPrefix,
	WIDGET_TOKEN_PREFIX,
} from "../tokens";

/**
 * The secret link to the home-screen widget page. A user has at most one;
 * issuing a new one replaces it, so the old link stops working at once.
 */
export const widgetRouter = router({
	/** Whether a link exists, and when it was made and last drawn. */
	link: browserProcedure.query(async ({ ctx }) => {
		const [row] = await ctx.db
			.select({
				createdAt: widgetToken.createdAt,
				lastUsedAt: widgetToken.lastUsedAt,
				prefix: widgetToken.prefix,
			})
			.from(widgetToken)
			.where(eq(widgetToken.userId, ctx.session.user.id))
			.limit(1);
		return row ?? null;
	}),

	/** Returns the secret once; only its hash is kept. */
	issue: browserProcedure.mutation(async ({ ctx }) => {
		const token = generateToken(WIDGET_TOKEN_PREFIX);
		const row = {
			createdAt: new Date(ctx.now()),
			id: crypto.randomUUID(),
			lastUsedAt: null,
			prefix: tokenPrefix(token),
			tokenHash: await hashToken(token),
			userId: ctx.session.user.id,
		};
		await ctx.db
			.insert(widgetToken)
			.values(row)
			.onConflictDoUpdate({
				target: widgetToken.userId,
				set: {
					createdAt: row.createdAt,
					id: row.id,
					lastUsedAt: null,
					prefix: row.prefix,
					tokenHash: row.tokenHash,
				},
			});
		return { createdAt: row.createdAt, prefix: row.prefix, token };
	}),

	revoke: browserProcedure.mutation(async ({ ctx }) => {
		const deleted = await ctx.db
			.delete(widgetToken)
			.where(eq(widgetToken.userId, ctx.session.user.id))
			.returning({ id: widgetToken.id });
		return { revoked: deleted.length > 0 };
	}),
});
