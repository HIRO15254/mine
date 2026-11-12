import { createDb } from "@mine/db";
import { describe, expect, it } from "vitest";

import { createAuth, GOOGLE_CALENDAR_SCOPES } from "../index";

function testAuth() {
	return createAuth(createDb({} as Parameters<typeof createDb>[0]), {
		allowedEmails: ["me@example.com"],
		baseURL: "http://localhost:8787",
		corsOrigin: "http://localhost:3001",
		googleClientId: "id",
		googleClientSecret: "secret",
		secret: "x".repeat(32),
	});
}

describe("createAuth", () => {
	it("creates an account only for a listed address", async () => {
		const before = testAuth().options.databaseHooks.user.create.before;
		const account = (email: string) => ({
			createdAt: new Date(),
			email,
			emailVerified: true,
			id: "u1",
			name: "Someone",
			updatedAt: new Date(),
		});

		await expect(before(account("Me@Example.com"))).resolves.toMatchObject({
			data: { email: "Me@Example.com" },
		});
		expect(() => before(account("someone@example.com"))).toThrow(
			"This account is not allowed to sign in"
		);
	});

	it("asks Google for offline access to read calendars and write events", () => {
		const auth = testAuth();

		expect(auth.options.socialProviders?.google).toMatchObject({
			accessType: "offline",
			prompt: "select_account consent",
			scope: GOOGLE_CALENDAR_SCOPES,
		});
		expect(GOOGLE_CALENDAR_SCOPES).toEqual([
			"https://www.googleapis.com/auth/calendar.readonly",
			"https://www.googleapis.com/auth/calendar.events",
		]);
	});
});
