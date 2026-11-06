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
	return { call };
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
