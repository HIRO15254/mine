import { user } from "@mine/db/schema/auth";
import { oauthGrant } from "@mine/db/schema/oauth";
import { apiToken } from "@mine/db/schema/token";
import { and, eq, gt } from "drizzle-orm";

import type { Context, Session } from "./context";

export const TOKEN_PREFIX = "mine_";
/** OAuth access and refresh tokens issued to apps such as Claude. */
export const ACCESS_TOKEN_PREFIX = "mine_at_";
export const REFRESH_TOKEN_PREFIX = "mine_rt_";
const PREFIX_LENGTH = TOKEN_PREFIX.length + 6;
const PADDING = /=+$/;
const BEARER = /^Bearer\s+(\S+)$/i;

export function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(PADDING, "");
}

/** A new random token: the prefix and 43 URL-safe characters. */
export function generateToken(prefix = TOKEN_PREFIX): string {
	return prefix + base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export function tokenPrefix(token: string): string {
	return token.slice(0, PREFIX_LENGTH);
}

export async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token)
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/** The token in an `Authorization: Bearer mine_…` header, if any. */
export function bearerToken(header: string | null | undefined): string | null {
	const match = header ? BEARER.exec(header.trim()) : null;
	const token = match?.[1];
	return token?.startsWith(TOKEN_PREFIX) ? token : null;
}

async function resolveAccessToken(
	db: Context["db"],
	token: string,
	now: Date
): Promise<Session | null> {
	const [row] = await db
		.select({
			email: user.email,
			grantId: oauthGrant.id,
			id: user.id,
			name: user.name,
		})
		.from(oauthGrant)
		.innerJoin(user, eq(user.id, oauthGrant.userId))
		.where(
			and(
				eq(oauthGrant.accessHash, await hashToken(token)),
				gt(oauthGrant.accessExpiresAt, now.getTime())
			)
		)
		.limit(1);
	if (!row) {
		return null;
	}
	await db
		.update(oauthGrant)
		.set({ lastUsedAt: now })
		.where(eq(oauthGrant.id, row.grantId));
	return {
		user: { email: row.email, id: row.id, name: row.name },
		via: "token",
	};
}

/**
 * Resolves a personal API token or an OAuth access token to its owner's
 * session and records when it was used. Refresh tokens match neither table,
 * so they are never accepted as a bearer token.
 */
export async function resolveTokenSession(
	db: Context["db"],
	token: string,
	now: Date = new Date()
): Promise<Session | null> {
	if (token.startsWith(ACCESS_TOKEN_PREFIX)) {
		const session = await resolveAccessToken(db, token, now);
		if (session) {
			return session;
		}
	}
	const tokenHash = await hashToken(token);
	const [row] = await db
		.select({
			email: user.email,
			id: user.id,
			name: user.name,
			tokenId: apiToken.id,
		})
		.from(apiToken)
		.innerJoin(user, eq(user.id, apiToken.userId))
		.where(eq(apiToken.tokenHash, tokenHash))
		.limit(1);
	if (!row) {
		return null;
	}
	await db
		.update(apiToken)
		.set({ lastUsedAt: now })
		.where(eq(apiToken.id, row.tokenId));
	return {
		user: { email: row.email, id: row.id, name: row.name },
		via: "token",
	};
}
