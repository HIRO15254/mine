import { describe, expect, it } from "vitest";

// The API package's node:sqlite D1 stand-in, with the real migrations.
import { createTestDb } from "../../../../packages/api/src/__tests__/d1";
import type { Bindings } from "../bindings";
import { app } from "../worker";

async function setup() {
	const { d1, sqlite } = createTestDb();
	sqlite
		.prepare("insert into user (id, name, email) values (?, ?, ?)")
		.run("u1", "Me", "me@example.com");
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
	return { call, raw, sqlite };
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
			error: "Unknown project: どこか",
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
			authorization_endpoint: "https://web.example.test/oauth/authorize",
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
