import { oauthClient, oauthGrant } from "@mine/db/schema/oauth";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { browserProcedure, router } from "../index";

/** Connected apps, for the signed-in browser only. */
export const oauthRouter = router({
	connections: browserProcedure.query(({ ctx }) =>
		ctx.db
			.select({
				createdAt: oauthGrant.createdAt,
				id: oauthGrant.id,
				lastUsedAt: oauthGrant.lastUsedAt,
				name: oauthClient.name,
			})
			.from(oauthGrant)
			.innerJoin(oauthClient, eq(oauthClient.id, oauthGrant.clientId))
			// A connection whose refresh token ran out can no longer be used.
			.where(
				and(
					eq(oauthGrant.userId, ctx.session.user.id),
					gt(oauthGrant.refreshExpiresAt, ctx.now())
				)
			)
			.orderBy(desc(oauthGrant.createdAt))
	),

	revoke: browserProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const deleted = await ctx.db
				.delete(oauthGrant)
				.where(
					and(
						eq(oauthGrant.id, input.id),
						eq(oauthGrant.userId, ctx.session.user.id)
					)
				)
				.returning({ id: oauthGrant.id });
			if (deleted.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Not connected" });
			}
			return { id: input.id };
		}),
});
