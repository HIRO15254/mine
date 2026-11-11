import { describe, expect, it } from "vitest";

import { createContextFactory, type Session } from "../context";
import {
	ACCESS_TTL_MS,
	approveAuthorization,
	authorizationServerMetadata,
	CODE_TTL_MS,
	checkAuthorization,
	deniedRedirect,
	exchangeToken,
	isAllowedRedirectUri,
	OAuthError,
	registerClient,
	UNUSED_CLIENT_LIMIT,
} from "../oauth";
import { appRouter } from "../routers/index";
import { base64url, resolveTokenSession } from "../tokens";
import { createTestDb } from "./d1";

const CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "a-very-long-pkce-verifier-with-enough-entropy-0123456789";
const NOW = Date.parse("2026-11-06T00:00:00Z");

async function challenge(verifier: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(verifier)
	);
	return base64url(new Uint8Array(digest));
}

function setup() {
	const { db, sqlite } = createTestDb();
	sqlite
		.prepare("insert into user (id, name, email) values (?, ?, ?)")
		.run("u1", "Me", "me@example.com");
	return { db, sqlite };
}

async function authorize(db: ReturnType<typeof setup>["db"]) {
	const client = await registerClient(db, {
		client_name: "Claude",
		redirect_uris: [CLAUDE],
		token_endpoint_auth_method: "none",
	});
	const redirect = new URL(
		await approveAuthorization(
			db,
			{
				clientId: client.client_id,
				codeChallenge: await challenge(VERIFIER),
				redirectUri: CLAUDE,
				state: "xyz",
				userId: "u1",
			},
			NOW
		)
	);
	return { client, code: redirect.searchParams.get("code") ?? "", redirect };
}

function codeParams(clientId: string, code: string, verifier = VERIFIER) {
	return {
		client_id: clientId,
		code,
		code_verifier: verifier,
		grant_type: "authorization_code",
		redirect_uri: CLAUDE,
	};
}

describe("redirect URIs", () => {
	it("allows Claude's callback and loopback addresses only", () => {
		expect(isAllowedRedirectUri(CLAUDE)).toBe(true);
		expect(
			isAllowedRedirectUri("https://claude.com/api/mcp/auth_callback")
		).toBe(true);
		expect(isAllowedRedirectUri("http://localhost:33418/callback")).toBe(true);
		expect(isAllowedRedirectUri("http://127.0.0.1:5000/cb")).toBe(true);
		expect(isAllowedRedirectUri("https://evil.example/callback")).toBe(false);
		expect(isAllowedRedirectUri("https://claude.ai/other")).toBe(false);
		expect(isAllowedRedirectUri("http://localhost.evil.example/cb")).toBe(
			false
		);
		expect(isAllowedRedirectUri("not a url")).toBe(false);
	});

	it("rejects registration with another redirect URI", async () => {
		const { db } = setup();
		await expect(
			registerClient(db, { redirect_uris: ["https://evil.example/cb"] })
		).rejects.toBeInstanceOf(OAuthError);
	});

	it("rejects a redirect URI too long to be real", async () => {
		const { db } = setup();
		await expect(
			registerClient(db, {
				redirect_uris: [`http://localhost/${"a".repeat(3000)}`],
			})
		).rejects.toBeInstanceOf(OAuthError);
	});
});

describe("authorization code flow", () => {
	it("exchanges a code for tokens that sign in as the user", async () => {
		const { db } = setup();
		const { client, code, redirect } = await authorize(db);
		expect(redirect.origin + redirect.pathname).toBe(CLAUDE);
		expect(redirect.searchParams.get("state")).toBe("xyz");
		expect(client.client_secret).toBeUndefined();

		const tokens = await exchangeToken(
			db,
			codeParams(client.client_id, code),
			null,
			NOW + 1000
		);
		expect(tokens).toMatchObject({
			expires_in: ACCESS_TTL_MS / 1000,
			token_type: "Bearer",
		});
		expect(tokens.access_token.startsWith("mine_at_")).toBe(true);

		const session = await resolveTokenSession(
			db,
			tokens.access_token,
			new Date(NOW + 2000)
		);
		expect(session).toMatchObject({ user: { id: "u1" }, via: "oauth" });
		// The refresh token is not a bearer token.
		expect(await resolveTokenSession(db, tokens.refresh_token)).toBeNull();
		// Access tokens expire.
		expect(
			await resolveTokenSession(
				db,
				tokens.access_token,
				new Date(NOW + ACCESS_TTL_MS + 5000)
			)
		).toBeNull();
	});

	it("rejects a wrong verifier, a reused code and an expired code", async () => {
		const { db } = setup();
		const first = await authorize(db);
		await expect(
			exchangeToken(
				db,
				codeParams(first.client.client_id, first.code, "wrong-verifier"),
				null,
				NOW
			)
		).rejects.toMatchObject({ code: "invalid_grant" });
		// The failed attempt used the code up.
		await expect(
			exchangeToken(
				db,
				codeParams(first.client.client_id, first.code),
				null,
				NOW
			)
		).rejects.toMatchObject({ code: "invalid_grant" });

		const second = await authorize(db);
		await expect(
			exchangeToken(
				db,
				codeParams(second.client.client_id, second.code),
				null,
				NOW + CODE_TTL_MS + 1
			)
		).rejects.toMatchObject({ code: "invalid_grant" });
	});

	it("rotates refresh tokens", async () => {
		const { db } = setup();
		const { client, code } = await authorize(db);
		const tokens = await exchangeToken(
			db,
			codeParams(client.client_id, code),
			null,
			NOW
		);
		const params = {
			client_id: client.client_id,
			grant_type: "refresh_token",
			refresh_token: tokens.refresh_token,
		};
		const later = NOW + 1000;
		const renewed = await exchangeToken(db, params, null, later);
		expect(renewed.access_token).not.toBe(tokens.access_token);
		expect(
			await resolveTokenSession(db, tokens.access_token, new Date(later))
		).toBeNull();
		expect(
			await resolveTokenSession(db, renewed.access_token, new Date(later))
		).not.toBeNull();
		await expect(exchangeToken(db, params, null, later)).rejects.toMatchObject({
			code: "invalid_grant",
		});
	});

	it("requires the secret of a confidential client", async () => {
		const { db } = setup();
		const client = await registerClient(db, {
			redirect_uris: [CLAUDE],
			token_endpoint_auth_method: "client_secret_basic",
		});
		expect(client.client_secret).toBeDefined();
		const url = await approveAuthorization(
			db,
			{
				clientId: client.client_id,
				codeChallenge: await challenge(VERIFIER),
				redirectUri: CLAUDE,
				userId: "u1",
			},
			NOW
		);
		const code = new URL(url).searchParams.get("code") ?? "";
		await expect(
			exchangeToken(db, codeParams(client.client_id, code), null, NOW)
		).rejects.toMatchObject({ code: "invalid_client", status: 401 });

		const second = new URL(
			await approveAuthorization(
				db,
				{
					clientId: client.client_id,
					codeChallenge: await challenge(VERIFIER),
					redirectUri: CLAUDE,
					userId: "u1",
				},
				NOW
			)
		).searchParams.get("code");
		const basic = `Basic ${btoa(`${client.client_id}:${client.client_secret}`)}`;
		const tokens = await exchangeToken(
			db,
			{ ...codeParams(client.client_id, second ?? ""), client_id: "" },
			basic,
			NOW
		);
		expect(tokens.access_token).toBeTruthy();
	});

	it("refuses unregistered redirect URIs and unknown clients", async () => {
		const { db } = setup();
		const { client } = await authorize(db);
		await expect(
			approveAuthorization(
				db,
				{
					clientId: client.client_id,
					codeChallenge: await challenge(VERIFIER),
					redirectUri: "https://claude.com/api/mcp/auth_callback",
					userId: "u1",
				},
				NOW
			)
		).rejects.toBeInstanceOf(OAuthError);
		await expect(
			exchangeToken(db, codeParams("nope", "code"), null, NOW)
		).rejects.toMatchObject({ code: "invalid_client" });
		await expect(
			exchangeToken(
				db,
				{ client_id: client.client_id, grant_type: "password" },
				null,
				NOW
			)
		).rejects.toMatchObject({ code: "unsupported_grant_type" });
	});

	it("describes itself", () => {
		expect(authorizationServerMetadata("https://api.test")).toMatchObject({
			authorization_endpoint: "https://api.test/oauth/authorize",
			code_challenge_methods_supported: ["S256"],
			issuer: "https://api.test",
			token_endpoint: "https://api.test/oauth/token",
		});
	});
});

describe("checkAuthorization", () => {
	it("accepts a registered client with an S256 challenge", async () => {
		const { db } = setup();
		const client = await registerClient(db, {
			client_name: "Claude",
			redirect_uris: [CLAUDE],
		});
		const params = {
			client_id: client.client_id,
			code_challenge: await challenge(VERIFIER),
			code_challenge_method: "S256",
			redirect_uri: CLAUDE,
			response_type: "code",
			state: "s",
		};
		await expect(checkAuthorization(db, params)).resolves.toMatchObject({
			clientName: "Claude",
			ok: true,
			request: { clientId: client.client_id, state: "s" },
		});
		for (const broken of [
			{ client_id: "nope" },
			{ redirect_uri: "http://localhost:1/cb" },
			{ code_challenge_method: "plain" },
			{ response_type: "token" },
			{ code_challenge: "short" },
		]) {
			await expect(
				checkAuthorization(db, { ...params, ...broken })
			).resolves.toMatchObject({ ok: false });
		}
	});

	it("declines with access_denied and the state", () => {
		expect(deniedRedirect(CLAUDE, "s")).toBe(
			`${CLAUDE}?error=access_denied&state=s`
		);
	});
});

describe("oauth router", () => {
	async function callers(db: ReturnType<typeof setup>["db"]) {
		const callerWith = async (session: Session) =>
			appRouter.createCaller(
				await createContextFactory(db, () => Promise.resolve(session))()
			);
		const user = { email: "me@example.com", id: "u1", name: "Me" };
		return {
			browser: await callerWith({ user }),
			token: await callerWith({ user, via: "oauth" }),
		};
	}

	it("lists and revokes connections from the browser only", async () => {
		const { db } = setup();
		const { browser, token } = await callers(db);
		const client = await registerClient(db, {
			client_name: "Claude",
			redirect_uris: [CLAUDE],
		});

		await expect(token.oauth.connections()).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		const redirectUrl = await approveAuthorization(
			db,
			{
				clientId: client.client_id,
				codeChallenge: await challenge(VERIFIER),
				redirectUri: CLAUDE,
				userId: "u1",
			},
			Date.now()
		);
		const code = new URL(redirectUrl).searchParams.get("code") ?? "";
		await exchangeToken(
			db,
			codeParams(client.client_id, code),
			null,
			Date.now()
		);

		const [connection] = await browser.oauth.connections();
		expect(connection).toMatchObject({ lastUsedAt: null, name: "Claude" });
		await browser.oauth.revoke({ id: connection?.id ?? "" });
		expect(await browser.oauth.connections()).toEqual([]);
		await expect(
			browser.oauth.revoke({ id: connection?.id ?? "" })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("leaves out a connection whose refresh token ran out", async () => {
		const { db, sqlite } = setup();
		const { browser } = await callers(db);
		const { client, code } = await authorize(db);
		await exchangeToken(db, codeParams(client.client_id, code), null, NOW);
		expect(await browser.oauth.connections()).toHaveLength(1);

		sqlite
			.prepare("update oauth_grant set refresh_expires_at = ?")
			.run(Date.now() - 1);
		expect(await browser.oauth.connections()).toEqual([]);
	});
});

describe("client registration", () => {
	it("keeps connected clients and only the newest unused ones", async () => {
		const { db, sqlite } = setup();
		const { client, code } = await authorize(db);
		await exchangeToken(db, codeParams(client.client_id, code), null, NOW);
		const insert = sqlite.prepare(
			"insert into oauth_client (id, name, redirect_uris, created_at) values (?, 'x', '[]', ?)"
		);
		for (let index = 0; index < UNUSED_CLIENT_LIMIT + 5; index += 1) {
			insert.run(`old-${index}`, 1000 + index);
		}

		const newest = await registerClient(db, { redirect_uris: [CLAUDE] });

		const ids = (
			sqlite.prepare("select id from oauth_client").all() as Array<{
				id: string;
			}>
		).map((row) => row.id);
		// The connected client, the new one and the newest unused ones remain.
		expect(ids).toHaveLength(UNUSED_CLIENT_LIMIT + 1);
		expect(ids).toContain(client.client_id);
		expect(ids).toContain(newest.client_id);
		expect(ids).not.toContain("old-0");
		expect(ids).toContain(`old-${UNUSED_CLIENT_LIMIT + 4}`);
	});
});
