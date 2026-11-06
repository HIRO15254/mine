import { oauthClient, oauthCode, oauthGrant } from "@mine/db/schema/oauth";
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "./context";
import {
	ACCESS_TOKEN_PREFIX,
	base64url,
	generateToken,
	hashToken,
	REFRESH_TOKEN_PREFIX,
} from "./tokens";

/**
 * A minimal OAuth 2.1 authorization server for MCP clients (Claude):
 * dynamic client registration, authorization code with PKCE (S256 only)
 * and rotating refresh tokens. The consent screen lives in the web app.
 */

type Db = Context["db"];

const MINUTE = 60_000;
export const CODE_TTL_MS = 10 * MINUTE;
export const ACCESS_TTL_MS = 60 * MINUTE;
export const REFRESH_TTL_MS = 90 * 24 * 60 * MINUTE;

const CLIENT_SECRET_PREFIX = "mine_cs_";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** Claude's hosted callback, used by claude.ai, the desktop and mobile apps. */
const HOSTED_REDIRECTS = new Set([
	"https://claude.ai/api/mcp/auth_callback",
	"https://claude.com/api/mcp/auth_callback",
]);

export class OAuthError extends Error {
	readonly code: string;
	readonly status: 400 | 401;

	constructor(code: string, description: string, status: 400 | 401 = 400) {
		super(description);
		this.code = code;
		this.status = status;
	}

	toJSON() {
		return { error: this.code, error_description: this.message };
	}
}

/** Claude's callback, or a loopback address for local clients (Claude Code). */
export function isAllowedRedirectUri(uri: string): boolean {
	if (HOSTED_REDIRECTS.has(uri)) {
		return true;
	}
	try {
		const url = new URL(uri);
		return (
			url.protocol === "http:" &&
			LOOPBACK_HOSTS.has(url.hostname) &&
			url.username === "" &&
			url.password === "" &&
			url.hash === ""
		);
	} catch {
		return false;
	}
}

/**
 * The consent screen is served by the API itself, so every cookie it needs
 * stays first-party (browsers such as Safari drop cross-site cookies).
 */
export function authorizationServerMetadata(issuer: string) {
	return {
		issuer,
		authorization_endpoint: `${issuer}/oauth/authorize`,
		token_endpoint: `${issuer}/oauth/token`,
		registration_endpoint: `${issuer}/oauth/register`,
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: [
			"none",
			"client_secret_post",
			"client_secret_basic",
		],
		scopes_supported: ["mine"],
	};
}

export function protectedResourceMetadata(resource: string, issuer: string) {
	return {
		resource,
		authorization_servers: [issuer],
		bearer_methods_supported: ["header"],
		scopes_supported: ["mine"],
		resource_name: "Mine",
	};
}

const registrationSchema = z.object({
	client_name: z.string().trim().max(200).optional(),
	redirect_uris: z.array(z.string()).min(1).max(10),
	token_endpoint_auth_method: z
		.enum(["none", "client_secret_post", "client_secret_basic"])
		.optional(),
});

/** RFC 7591 dynamic client registration. */
export async function registerClient(db: Db, body: unknown) {
	const parsed = registrationSchema.safeParse(body);
	if (!parsed.success) {
		throw new OAuthError("invalid_client_metadata", "Invalid client metadata");
	}
	const input = parsed.data;
	const rejected = input.redirect_uris.find(
		(uri) => !isAllowedRedirectUri(uri)
	);
	if (rejected) {
		throw new OAuthError(
			"invalid_redirect_uri",
			`Redirect URI not allowed: ${rejected}`
		);
	}
	const method = input.token_endpoint_auth_method ?? "none";
	const secret = method === "none" ? null : generateToken(CLIENT_SECRET_PREFIX);
	const id = crypto.randomUUID();
	const name = input.client_name || "MCP クライアント";
	await db.insert(oauthClient).values({
		id,
		name,
		redirectUris: JSON.stringify(input.redirect_uris),
		secretHash: secret ? await hashToken(secret) : null,
	});
	return {
		client_id: id,
		client_id_issued_at: Math.floor(Date.now() / 1000),
		client_name: name,
		grant_types: ["authorization_code", "refresh_token"],
		redirect_uris: input.redirect_uris,
		response_types: ["code"],
		token_endpoint_auth_method: method,
		...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
	};
}

export async function findClient(db: Db, clientId: string) {
	const [row] = await db
		.select()
		.from(oauthClient)
		.where(eq(oauthClient.id, clientId))
		.limit(1);
	if (!row) {
		return null;
	}
	return {
		id: row.id,
		name: row.name,
		redirectUris: JSON.parse(row.redirectUris) as string[],
		secretHash: row.secretHash,
	};
}

const CHALLENGE = /^[\w-]{43}$/;

export type PendingAuthorization = Omit<AuthorizationRequest, "userId">;

/**
 * Checks an authorize query before anything is shown. Messages are Japanese
 * because they appear on the consent page.
 */
export async function checkAuthorization(
	db: Db,
	params: Record<string, string | undefined>
): Promise<
	| { error: string; ok: false }
	| { clientName: string; ok: true; request: PendingAuthorization }
> {
	const client = params.client_id
		? await findClient(db, params.client_id)
		: null;
	if (!(client && params.redirect_uri)) {
		return { error: "このアプリは登録されていません", ok: false };
	}
	if (!client.redirectUris.includes(params.redirect_uri)) {
		return { error: "戻り先が登録されたものと違います", ok: false };
	}
	if (
		params.response_type !== "code" ||
		params.code_challenge_method !== "S256" ||
		!CHALLENGE.test(params.code_challenge ?? "")
	) {
		return { error: "このアプリの接続方式には対応していません", ok: false };
	}
	return {
		clientName: client.name,
		ok: true,
		request: {
			clientId: client.id,
			codeChallenge: params.code_challenge ?? "",
			redirectUri: params.redirect_uri,
			scope: params.scope || undefined,
			state: params.state || undefined,
		},
	};
}

/** Where to send the user when they decline. */
export function deniedRedirect(redirectUri: string, state?: string): string {
	const url = new URL(redirectUri);
	url.searchParams.set("error", "access_denied");
	if (state) {
		url.searchParams.set("state", state);
	}
	return url.toString();
}

export interface AuthorizationRequest {
	clientId: string;
	codeChallenge: string;
	redirectUri: string;
	scope?: string;
	state?: string;
	userId: string;
}

/** Issues a code after the user approved, and returns where to send them. */
export async function approveAuthorization(
	db: Db,
	request: AuthorizationRequest,
	now: number
): Promise<string> {
	const client = await findClient(db, request.clientId);
	if (!client) {
		throw new OAuthError("invalid_client", "Unknown client");
	}
	if (!client.redirectUris.includes(request.redirectUri)) {
		throw new OAuthError("invalid_request", "Redirect URI not registered");
	}
	const code = generateToken("mine_code_");
	await db.delete(oauthCode).where(lt(oauthCode.expiresAt, now));
	await db.insert(oauthCode).values({
		clientId: client.id,
		codeChallenge: request.codeChallenge,
		codeHash: await hashToken(code),
		expiresAt: now + CODE_TTL_MS,
		redirectUri: request.redirectUri,
		scope: request.scope ?? "",
		userId: request.userId,
	});
	const url = new URL(request.redirectUri);
	url.searchParams.set("code", code);
	if (request.state) {
		url.searchParams.set("state", request.state);
	}
	return url.toString();
}

async function pkceChallenge(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(verifier)
	);
	return base64url(new Uint8Array(digest));
}

function basicCredentials(
	header: string | null
): { id: string; secret: string } | null {
	if (!header?.startsWith("Basic ")) {
		return null;
	}
	try {
		const decoded = atob(header.slice("Basic ".length).trim());
		const split = decoded.indexOf(":");
		if (split < 0) {
			return null;
		}
		return {
			id: decodeURIComponent(decoded.slice(0, split)),
			secret: decodeURIComponent(decoded.slice(split + 1)),
		};
	} catch {
		return null;
	}
}

/** Authenticates the client at the token endpoint. */
async function authenticateClient(
	db: Db,
	params: Record<string, string>,
	authorization: string | null
) {
	const basic = basicCredentials(authorization);
	const clientId = basic?.id ?? params.client_id;
	const secret = basic?.secret ?? params.client_secret;
	const client = clientId ? await findClient(db, clientId) : null;
	if (!client) {
		throw new OAuthError("invalid_client", "Unknown client", 401);
	}
	if (
		client.secretHash &&
		!(secret && (await hashToken(secret)) === client.secretHash)
	) {
		throw new OAuthError("invalid_client", "Client authentication failed", 401);
	}
	return client;
}

async function issueTokens(now: number) {
	const accessToken = generateToken(ACCESS_TOKEN_PREFIX);
	const refreshToken = generateToken(REFRESH_TOKEN_PREFIX);
	return {
		response: {
			access_token: accessToken,
			expires_in: ACCESS_TTL_MS / 1000,
			refresh_token: refreshToken,
			token_type: "Bearer",
		},
		row: {
			accessExpiresAt: now + ACCESS_TTL_MS,
			accessHash: await hashToken(accessToken),
			refreshExpiresAt: now + REFRESH_TTL_MS,
			refreshHash: await hashToken(refreshToken),
		},
	};
}

async function exchangeCode(
	db: Db,
	params: Record<string, string>,
	clientId: string,
	now: number
) {
	const { code, code_verifier: verifier, redirect_uri: redirectUri } = params;
	if (!(code && verifier && redirectUri)) {
		throw new OAuthError(
			"invalid_request",
			"code, code_verifier and redirect_uri are required"
		);
	}
	// Single use: the code is removed before it is checked.
	const [row] = await db
		.delete(oauthCode)
		.where(eq(oauthCode.codeHash, await hashToken(code)))
		.returning();
	if (
		!row ||
		row.expiresAt <= now ||
		row.clientId !== clientId ||
		row.redirectUri !== redirectUri ||
		(await pkceChallenge(verifier)) !== row.codeChallenge
	) {
		throw new OAuthError("invalid_grant", "Invalid authorization code");
	}
	const tokens = await issueTokens(now);
	await db.insert(oauthGrant).values({
		...tokens.row,
		clientId,
		id: crypto.randomUUID(),
		scope: row.scope,
		userId: row.userId,
	});
	return { ...tokens.response, scope: row.scope || "mine" };
}

async function refresh(
	db: Db,
	params: Record<string, string>,
	clientId: string,
	now: number
) {
	if (!params.refresh_token) {
		throw new OAuthError("invalid_request", "refresh_token is required");
	}
	const refreshHash = await hashToken(params.refresh_token);
	const [grant] = await db
		.select()
		.from(oauthGrant)
		.where(
			and(
				eq(oauthGrant.refreshHash, refreshHash),
				eq(oauthGrant.clientId, clientId)
			)
		)
		.limit(1);
	if (!grant || grant.refreshExpiresAt <= now) {
		throw new OAuthError("invalid_grant", "Invalid refresh token");
	}
	const tokens = await issueTokens(now);
	// Rotate only if nobody else rotated it first.
	const updated = await db
		.update(oauthGrant)
		.set(tokens.row)
		.where(
			and(eq(oauthGrant.id, grant.id), eq(oauthGrant.refreshHash, refreshHash))
		)
		.returning({ id: oauthGrant.id });
	if (updated.length === 0) {
		throw new OAuthError("invalid_grant", "Invalid refresh token");
	}
	return { ...tokens.response, scope: grant.scope || "mine" };
}

/** The token endpoint: authorization_code and refresh_token grants. */
export async function exchangeToken(
	db: Db,
	params: Record<string, string>,
	authorization: string | null,
	now: number
) {
	const client = await authenticateClient(db, params, authorization);
	switch (params.grant_type) {
		case "authorization_code":
			return exchangeCode(db, params, client.id, now);
		case "refresh_token":
			return refresh(db, params, client.id, now);
		default:
			throw new OAuthError(
				"unsupported_grant_type",
				"Only authorization_code and refresh_token are supported"
			);
	}
}
