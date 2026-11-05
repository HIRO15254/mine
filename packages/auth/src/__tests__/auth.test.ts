import { createDb } from "@mine/db";
import { describe, expect, it } from "vitest";

import { createAuth, GOOGLE_CALENDAR_SCOPE } from "../index";

describe("createAuth", () => {
	it("asks Google for offline calendar access", () => {
		const auth = createAuth(createDb({} as Parameters<typeof createDb>[0]), {
			allowedEmails: ["me@example.com"],
			baseURL: "http://localhost:8787",
			corsOrigin: "http://localhost:3001",
			googleClientId: "id",
			googleClientSecret: "secret",
			secret: "x".repeat(32),
		});

		expect(auth.options.socialProviders?.google).toMatchObject({
			accessType: "offline",
			prompt: "select_account consent",
			scope: [GOOGLE_CALENDAR_SCOPE],
		});
	});
});
