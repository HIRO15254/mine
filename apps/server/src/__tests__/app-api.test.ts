import { createTestApp } from "@mine/api/testing";
import { describe, expect, it } from "vitest";
import type { Bindings } from "../bindings";
import { app } from "../worker";

async function setup() {
	const { d1, sqlite } = await createTestApp();
	const token = "mine_test-token-0000000000000000000000000000000";
	const hash = [
		...new Uint8Array(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
		),
	]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	sqlite
		.prepare(
			"insert into api_token (id, user_id, name, token_hash, prefix) values (?, ?, ?, ?, ?)"
		)
		.run("t1", "u1", "test", hash, token.slice(0, 11));
	sqlite
		.prepare(
			"insert into project (id, user_id, name, parent_id) values ('p1', 'u1', '仕事', null)"
		)
		.run();
	const bindings = {
		ALLOWED_EMAILS: "me@example.com",
		BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
		BETTER_AUTH_URL: "https://api.example.test",
		CORS_ORIGIN: "https://web.example.test",
		DB: d1,
		GOOGLE_CLIENT_ID: "client-id",
		GOOGLE_CLIENT_SECRET: "client-secret",
	} as Bindings;
	const call = (path: string, init: RequestInit = {}) =>
		app.request(
			path,
			{
				...init,
				headers: { Authorization: `Bearer ${token}`, ...init.headers },
			},
			bindings
		);
	const raw = (path: string, init: RequestInit = {}) =>
		app.request(path, init, bindings);
	return { bindings, call, raw, sqlite };
}

async function s256(verifier: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(verifier)
	);
	return btoa(String.fromCharCode(...new Uint8Array(digest)))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

describe("app API", () => {
	it("starts, reads and stops the timer with a token", async () => {
		const { call } = await setup();

		const idle = await call("/v1/timer");
		expect(idle.status).toBe(200);
		await expect(idle.json()).resolves.toMatchObject({ running: false });

		const started = await call("/v1/timer/start?project=仕事", {
			body: JSON.stringify({ description: "資料" }),
			method: "POST",
		});
		expect(started.status).toBe(200);
		await expect(started.json()).resolves.toMatchObject({
			description: "資料",
			project: "仕事",
			running: true,
		});

		const stopped = await call("/v1/timer/stop", { method: "POST" });
		await expect(stopped.json()).resolves.toMatchObject({ stopped: true });

		const projects = await call("/v1/projects");
		await expect(projects.json()).resolves.toEqual([
			{ id: "p1", name: "仕事", path: "仕事" },
		]);
	});

	it("reports bad input and unknown tokens", async () => {
		const { call } = await setup();

		const unknown = await call("/v1/timer/start", {
			body: JSON.stringify({ project: "どこか" }),
			method: "POST",
		});
		expect(unknown.status).toBe(400);
		await expect(unknown.json()).resolves.toEqual({
			error: 'Unknown project "どこか". Projects: 仕事',
		});

		const broken = await call("/v1/timer/start", {
			body: "{",
			method: "POST",
		});
		expect(broken.status).toBe(400);

		const wrong = await call("/v1/timer", {
			headers: {
				Authorization:
					"Bearer mine_unknown-token-00000000000000000000000000000",
			},
		});
		expect(wrong.status).toBe(401);
	});
});

const CLAUDE = "https://claude.ai/api/mcp/auth_callback";

describe("MCP over HTTP", () => {
	it("asks for OAuth and describes the servers", async () => {
		const { raw } = await setup();

		const denied = await raw("/mcp", {
			body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "ping" }),
			method: "POST",
		});
		expect(denied.status).toBe(401);
		expect(denied.headers.get("WWW-Authenticate")).toBe(
			'Bearer resource_metadata="http://localhost/.well-known/oauth-protected-resource/mcp"'
		);

		const resource = await raw("/.well-known/oauth-protected-resource/mcp");
		await expect(resource.json()).resolves.toMatchObject({
			authorization_servers: ["http://localhost"],
			resource: "http://localhost/mcp",
		});
		const server = await raw("/.well-known/oauth-authorization-server");
		await expect(server.json()).resolves.toMatchObject({
			authorization_endpoint: "http://localhost/oauth/authorize",
			registration_endpoint: "http://localhost/oauth/register",
			token_endpoint: "http://localhost/oauth/token",
		});
		expect((await raw("/mcp")).status).toBe(405);
	});

	it("serves tools to a personal API token", async () => {
		const { call } = await setup();
		const reply = await call("/mcp", {
			body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		expect(reply.status).toBe(200);
		const body = (await reply.json()) as { result: { tools: unknown[] } };
		expect(body.result.tools.length).toBeGreaterThan(5);

		const note = await call("/mcp", {
			body: JSON.stringify({
				jsonrpc: "2.0",
				method: "notifications/initialized",
			}),
			method: "POST",
		});
		expect(note.status).toBe(202);
	});

	it("registers a client and trades a code for a working token", async () => {
		const { raw, sqlite } = await setup();
		const registered = await raw("/oauth/register", {
			body: JSON.stringify({
				client_name: "Claude",
				redirect_uris: [CLAUDE],
				token_endpoint_auth_method: "none",
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		expect(registered.status).toBe(201);
		const client = (await registered.json()) as { client_id: string };

		const rejected = await raw("/oauth/register", {
			body: JSON.stringify({ redirect_uris: ["https://evil.example/cb"] }),
			method: "POST",
		});
		expect(rejected.status).toBe(400);

		// What the consent screen's approval stores.
		const verifier = "verifier-verifier-verifier-verifier-verifier-0";
		const code = "mine_code_test";
		const codeHash = [
			...new Uint8Array(
				await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))
			),
		]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
		sqlite
			.prepare(
				"insert into oauth_code (code_hash, client_id, user_id, redirect_uri, code_challenge, expires_at) values (?, ?, ?, ?, ?, ?)"
			)
			.run(
				codeHash,
				client.client_id,
				"u1",
				CLAUDE,
				await s256(verifier),
				Date.now() + 60_000
			);

		const token = await raw("/oauth/token", {
			body: new URLSearchParams({
				client_id: client.client_id,
				code,
				code_verifier: verifier,
				grant_type: "authorization_code",
				redirect_uri: CLAUDE,
			}).toString(),
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			method: "POST",
		});
		expect(token.status).toBe(200);
		expect(token.headers.get("Cache-Control")).toBe("no-store");
		const tokens = (await token.json()) as { access_token: string };

		const reply = await raw("/mcp", {
			body: JSON.stringify({
				id: 1,
				jsonrpc: "2.0",
				method: "tools/call",
				params: { arguments: {}, name: "get_timer" },
			}),
			headers: { Authorization: `Bearer ${tokens.access_token}` },
			method: "POST",
		});
		expect(reply.status).toBe(200);
		await expect(reply.json()).resolves.toMatchObject({
			result: { isError: false },
		});

		// The consent screen promised the MCP tools, nothing wider.
		const asOAuth = { Authorization: `Bearer ${tokens.access_token}` };
		const viaRest = await raw("/v1/timer", { headers: asOAuth });
		expect(viaRest.status).toBe(401);
		const viaTrpc = await raw("/trpc/project.list", { headers: asOAuth });
		expect(viaTrpc.status).toBe(401);

		const reused = await raw("/oauth/token", {
			body: new URLSearchParams({
				client_id: client.client_id,
				code,
				code_verifier: verifier,
				grant_type: "authorization_code",
				redirect_uri: CLAUDE,
			}).toString(),
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			method: "POST",
		});
		expect(reused.status).toBe(400);
		await expect(reused.json()).resolves.toMatchObject({
			error: "invalid_grant",
		});
	});
});

describe("tRPC over HTTP", () => {
	const startTimer = (
		raw: Awaited<ReturnType<typeof setup>>["raw"],
		headers: Record<string, string>
	) => {
		// What another site's form can send without a CORS preflight.
		const body = new FormData();
		body.set("description", "攻撃");
		return raw("/trpc/time.start", { body, headers, method: "POST" });
	};

	it("refuses a cookie write that does not come from the web app", async () => {
		const { bindings, raw, sqlite } = await setup();
		const cookie = await sessionCookie(sqlite, bindings.BETTER_AUTH_SECRET);

		const foreign = await startTimer(raw, {
			Cookie: cookie,
			Origin: "https://evil.example",
		});
		expect(foreign.status).toBe(403);
		const unnamed = await startTimer(raw, { Cookie: cookie });
		expect(unnamed.status).toBe(403);
		expect(
			sqlite.prepare("select count(*) as n from time_entry").get()
		).toEqual({ n: 0 });

		const own = await raw("/trpc/time.start", {
			body: JSON.stringify({ description: "資料" }),
			headers: {
				"Content-Type": "application/json",
				Cookie: cookie,
				Origin: bindings.CORS_ORIGIN,
			},
			method: "POST",
		});
		expect(own.status).toBe(200);
		const read = await raw("/trpc/time.current", {
			headers: { Cookie: cookie },
		});
		expect(read.status).toBe(200);
	});

	it("takes a personal API token but keeps token admin to the browser", async () => {
		const { call } = await setup();

		const projects = await call("/trpc/project.list");
		expect(projects.status).toBe(200);
		const started = await call("/trpc/time.start", {
			body: JSON.stringify({ description: "資料" }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		expect(started.status).toBe(200);
		const tokens = await call("/trpc/token.list");
		expect(tokens.status).toBe(403);
	});

	it("looks the session up once for a batch of calls", async () => {
		const { call, sqlite } = await setup();
		sqlite.prepare("update api_token set last_used_at = null").run();
		let lookups = 0;
		const prepare = sqlite.prepare.bind(sqlite);
		sqlite.prepare = (source: string) => {
			if (source.includes("update") && source.includes("api_token")) {
				lookups += 1;
			}
			return prepare(source);
		};

		const batch = await call(
			"/trpc/project.list,label.list,time.current?batch=1&input=%7B%7D"
		);
		expect(batch.status).toBe(200);
		expect(lookups).toBe(1);
	});

	it("turns away an oversized registration", async () => {
		const { raw } = await setup();
		const response = await raw("/oauth/register", {
			body: JSON.stringify({
				client_name: "x".repeat(20_000),
				redirect_uris: [CLAUDE],
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		expect(response.status).toBe(413);
	});
});

const CODE_FORMAT = /^mine_code_/;
const HIDDEN_CSRF = /name="csrf" value="([^"]+)"/;
const SESSION_COOKIE = "__Secure-better-auth.session_token";

/** A Better Auth session cookie, signed the way better-call signs it. */
async function sessionCookie(
	sqlite: Awaited<ReturnType<typeof setup>>["sqlite"],
	secret: string
) {
	const token = "session-token-for-tests";
	const now = Math.floor(Date.now() / 1000);
	sqlite
		.prepare(
			"insert into session (id, expires_at, token, created_at, updated_at, user_id) values (?, ?, ?, ?, ?, ?)"
		)
		.run("s1", now + 3600, token, now, now, "u1");
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ hash: "SHA-256", name: "HMAC" },
		false,
		["sign"]
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(token)
	);
	const value = `${token}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
	return `${SESSION_COOKIE}=${encodeURIComponent(value)}`;
}

describe("OAuth consent page", () => {
	async function authorizeUrl(raw: Awaited<ReturnType<typeof setup>>["raw"]) {
		const registered = await raw("/oauth/register", {
			body: JSON.stringify({ client_name: "Claude", redirect_uris: [CLAUDE] }),
			method: "POST",
		});
		const { client_id: clientId } = (await registered.json()) as {
			client_id: string;
		};
		const query = new URLSearchParams({
			client_id: clientId,
			code_challenge: await s256("verifier-verifier-verifier-verifier-0"),
			code_challenge_method: "S256",
			redirect_uri: CLAUDE,
			response_type: "code",
			state: "st",
		});
		return { clientId, query, url: `/oauth/authorize?${query}` };
	}

	it("sends a signed-out user to Google with a first-party state cookie", async () => {
		const { raw } = await setup();
		const { url } = await authorizeUrl(raw);
		const response = await raw(url);
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toContain("accounts.google.com");
		expect(response.headers.getSetCookie().join("\n")).toContain("state");

		const broken = await raw("/oauth/authorize?client_id=nope");
		expect(broken.status).toBe(400);
		expect(await broken.text()).toContain("このアプリは登録されていません");
	});

	it("shows consent and issues a code only with the form's token", async () => {
		const { bindings, raw, sqlite } = await setup();
		const cookie = await sessionCookie(sqlite, bindings.BETTER_AUTH_SECRET);
		const { query, url } = await authorizeUrl(raw);

		const page = await raw(url, { headers: { Cookie: cookie } });
		expect(page.status).toBe(200);
		expect(page.headers.get("X-Frame-Options")).toBe("DENY");
		const html = await page.text();
		expect(html).toContain("Claude を接続");
		expect(html).toContain("me@example.com");
		const csrf = HIDDEN_CSRF.exec(html)?.[1] ?? "";
		expect(csrf).not.toBe("");

		const post = (fields: Record<string, string>, headers = {}) =>
			raw("/oauth/authorize", {
				body: new URLSearchParams({
					...Object.fromEntries(query),
					...fields,
				}).toString(),
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Cookie: cookie,
					...headers,
				},
				method: "POST",
			});

		expect((await post({ csrf: "forged", decision: "allow" })).status).toBe(
			403
		);
		expect(
			(
				await post(
					{ csrf, decision: "allow" },
					{ Origin: "https://evil.example" }
				)
			).status
		).toBe(403);

		expect(page.headers.get("Referrer-Policy")).toBe("same-origin");
		expect(
			(await post({ csrf: "forged", decision: "allow" }, { Origin: "null" }))
				.status
		).toBe(403);

		const denied = await post({ csrf, decision: "deny" }, { Origin: "null" });
		expect(denied.status).toBe(303);
		expect(denied.headers.get("Location")).toBe(
			`${CLAUDE}?error=access_denied&state=st`
		);

		const allowed = await post(
			{ csrf, decision: "allow" },
			{ Origin: "http://localhost" }
		);
		expect(allowed.status).toBe(303);
		const location = new URL(allowed.headers.get("Location") ?? "");
		expect(location.origin + location.pathname).toBe(CLAUDE);
		expect(location.searchParams.get("state")).toBe("st");
		expect(location.searchParams.get("code")).toMatch(CODE_FORMAT);
	});
});
