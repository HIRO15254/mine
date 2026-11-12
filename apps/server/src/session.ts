import {
	createContextFactory,
	type Session,
	type TokenKind,
} from "@mine/api/context";
import { appRouter } from "@mine/api/routers/index";
import { bearerToken, resolveTokenSession } from "@mine/api/tokens";
import { createAuth } from "@mine/auth";
import { isEmailAllowed, parseAllowedEmails } from "@mine/auth/allowlist";
import { createDb, type Database } from "@mine/db";

import type { Bindings } from "./bindings";

export function authFor(env: Bindings, db: Database) {
	return createAuth(db, {
		allowedEmails: parseAllowedEmails(env.ALLOWED_EMAILS),
		baseURL: env.BETTER_AUTH_URL,
		corsOrigin: env.CORS_ORIGIN,
		googleClientId: env.GOOGLE_CLIENT_ID,
		googleClientSecret: env.GOOGLE_CLIENT_SECRET,
		secret: env.BETTER_AUTH_SECRET,
	});
}

type Auth = ReturnType<typeof authFor>;

/**
 * The ways a request can say who it is from: the browser's session cookie, a
 * personal API token, or an OAuth access token issued to an app such as
 * Claude. Each surface names the ones it takes.
 */
export type AuthKind = "cookie" | TokenKind;

export type Caller = ReturnType<typeof appRouter.createCaller>;

/**
 * Sessions and tokens outlive a change to ALLOWED_EMAILS, so the list is
 * checked on every request: taking an address off it locks the account out
 * at once, whatever it still holds.
 */
function isAllowed(env: Bindings, email: string): boolean {
	return isEmailAllowed(email, parseAllowedEmails(env.ALLOWED_EMAILS));
}

/** The browser's Better Auth session, unless its account left the allowlist. */
export async function cookieSession(
	env: Bindings,
	auth: Auth,
	headers: Headers
) {
	const session = await auth.api.getSession({ headers });
	return session && isAllowed(env, session.user.email) ? session : null;
}

/**
 * Who the request is from, if it signed in a way this surface accepts. A
 * bearer token is never mixed with the cookie: a request that sends one is
 * judged by the token alone.
 */
async function resolveSession(
	env: Bindings,
	db: Database,
	auth: Auth,
	headers: Headers,
	accept: readonly AuthKind[]
): Promise<Session | null> {
	const token = bearerToken(headers.get("Authorization"));
	if (token) {
		const session = await resolveTokenSession(db, token);
		return session?.via &&
			accept.includes(session.via) &&
			isAllowed(env, session.user.email)
			? session
			: null;
	}
	if (!accept.includes("cookie")) {
		return null;
	}
	const session = await cookieSession(env, auth, headers);
	return session ? { user: session.user } : null;
}

/**
 * Everything a surface needs to run procedures for one request: the session
 * (looked up once, however many procedures a batch calls) and the tRPC
 * context built on it.
 */
export function requestContext(
	env: Bindings,
	headers: Headers,
	accept: readonly AuthKind[]
) {
	const db = createDb(env.DB);
	const auth = authFor(env, db);
	let pending: Promise<Session | null> | undefined;
	const session = () => {
		pending ??= resolveSession(env, db, auth, headers, accept);
		return pending;
	};
	/*
	 * A browser session reads Google tokens through its cookie; a token session
	 * (API token or OAuth app) looks them up by user, since it has no cookie.
	 */
	const getGoogleAccessToken = async () => {
		const current = await session();
		if (!current) {
			return null;
		}
		try {
			const token = current.via
				? await auth.api.getAccessToken({
						body: { providerId: "google", userId: current.user.id },
					})
				: await auth.api.getAccessToken({
						body: { providerId: "google" },
						headers,
					});
			return token.accessToken ?? null;
		} catch {
			return null;
		}
	};
	return {
		createContext: createContextFactory(db, session, { getGoogleAccessToken }),
		session,
	};
}

/** A caller for the signed-in user, or null when the request is not signed in. */
export async function resolveCaller(
	env: Bindings,
	headers: Headers,
	accept: readonly AuthKind[]
): Promise<Caller | null> {
	const { createContext, session } = requestContext(env, headers, accept);
	return (await session())
		? appRouter.createCaller(await createContext())
		: null;
}
