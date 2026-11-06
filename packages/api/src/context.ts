import type { Database } from "@mine/db";

import type { FetchLike } from "./google/calendar";

export interface SessionUser {
	email: string;
	id: string;
	image?: string | null;
	name: string;
}

export interface Session {
	user: SessionUser;
	/** Set when the request was authenticated with a personal API token. */
	via?: "token";
}

export type SessionResolver = () => Promise<Session | null>;

/** Returns a valid Google access token for the signed-in user, or null. */
export type GoogleAccessTokenResolver = () => Promise<string | null>;

export interface Context extends Record<string, unknown> {
	db: Database;
	fetch: FetchLike;
	getGoogleAccessToken: GoogleAccessTokenResolver;
	/** Current time in epoch milliseconds; injectable for tests. */
	now: () => number;
	resolveSession: SessionResolver;
}

export interface ContextOptions {
	fetch?: FetchLike;
	getGoogleAccessToken?: GoogleAccessTokenResolver;
	now?: () => number;
}

const noSession: SessionResolver = () => Promise.resolve(null);
const noGoogleToken: GoogleAccessTokenResolver = () => Promise.resolve(null);

export function createContextFactory(
	db: Database,
	resolveSession: SessionResolver = noSession,
	options: ContextOptions = {}
): () => Promise<Context> {
	return () =>
		Promise.resolve({
			db,
			fetch: options.fetch ?? ((input, init) => fetch(input, init)),
			getGoogleAccessToken: options.getGoogleAccessToken ?? noGoogleToken,
			now: options.now ?? Date.now,
			resolveSession,
		});
}
