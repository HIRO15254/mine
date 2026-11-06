import { oauthClient, oauthGrant } from "@mine/db/schema/oauth";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { browserProcedure, router } from "../index";
import { approveAuthorization, findClient, OAuthError } from "../oauth";

const clientInput = z.object({
	clientId: z.string().min(1).max(100),
	redirectUri: z.string().min(1).max(2000),
});

function badRequest(error: unknown): never {
	if (error instanceof OAuthError) {
		throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
	}
	throw error;
}

/** Consent and connected apps, for the signed-in browser only. */
export const oauthRouter = router({
	/** What the consent screen shows; fails for an unknown client or URI. */
	client: browserProcedure.input(clientInput).query(async ({ ctx, input }) => {
		const client = await findClient(ctx.db, input.clientId);
		if (!client?.redirectUris.includes(input.redirectUri)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Unknown client or redirect URI",
			});
		}
		return {
			name: client.name,
			redirectHost: new URL(input.redirectUri).host,
		};
	}),

	approve: browserProcedure
		.input(
			clientInput.extend({
				/** S256 challenge: base64url of a SHA-256 digest. */
				codeChallenge: z.string().regex(/^[\w-]{43}$/),
				scope: z.string().max(500).optional(),
				state: z.string().max(2000).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const redirectUrl = await approveAuthorization(
					ctx.db,
					{ ...input, userId: ctx.session.user.id },
					ctx.now()
				);
				return { redirectUrl };
			} catch (error) {
				badRequest(error);
			}
		}),

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
			.where(eq(oauthGrant.userId, ctx.session.user.id))
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
