import { describe, expect, it } from "vitest";
import type { Bindings } from "../bindings";
import { app } from "../worker";

const bindings: Bindings = {
	ALLOWED_EMAILS: "me@example.com",
	BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
	BETTER_AUTH_URL: "https://api.example.test",
	CORS_ORIGIN: "https://web.example.test",
	DB: {} as D1Database,
	GOOGLE_CLIENT_ID: "client-id",
	GOOGLE_CLIENT_SECRET: "client-secret",
};

describe("worker", () => {
	it("returns the HTTP health response", async () => {
		const response = await app.request("/", {}, bindings);

		expect(response.status).toBe(200);
		await expect(response.text()).resolves.toBe("OK");
	});

	it("sends favicon lookups to the web app's icon", async () => {
		const response = await app.request("/favicon.ico", {}, bindings);

		expect(response.status).toBe(301);
		expect(response.headers.get("Location")).toBe(
			"https://web.example.test/favicon.ico"
		);
	});

	it("serves the tRPC health check", async () => {
		const response = await app.request("/trpc/healthCheck", {}, bindings);
		const payload = (await response.json()) as {
			result?: { data?: string };
		};

		expect(response.status).toBe(200);
		expect(payload.result?.data).toBe("OK");
	});

	it("allows the configured web origin", async () => {
		const response = await app.request(
			"/",
			{ headers: { Origin: bindings.CORS_ORIGIN } },
			bindings
		);

		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			bindings.CORS_ORIGIN
		);
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
			"true"
		);
	});

	it("rejects a protected procedure without a session cookie", async () => {
		const response = await app.request("/trpc/me", {}, bindings);

		expect(response.status).toBe(401);
	});

	it("requires an API token for the app API", async () => {
		const missing = await app.request("/v1/timer", {}, bindings);
		const wrongScheme = await app.request(
			"/v1/timer/stop",
			{ headers: { Authorization: "Bearer not-a-mine-token" }, method: "POST" },
			bindings
		);

		expect(missing.status).toBe(401);
		await expect(missing.json()).resolves.toEqual({
			error: "API token required",
		});
		expect(wrongScheme.status).toBe(401);
	});
});
