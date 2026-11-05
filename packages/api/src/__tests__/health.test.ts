import { createDb } from "@mine/db";
import { describe, expect, it } from "vitest";

import { createContextFactory } from "../context";
import { appRouter } from "../routers/index";

const db = createDb({} as Parameters<typeof createDb>[0]);

describe("healthCheck", () => {
	it("returns OK without a session", async () => {
		const caller = appRouter.createCaller(await createContextFactory(db)());

		await expect(caller.healthCheck()).resolves.toBe("OK");
	});
});

describe("me", () => {
	it("rejects a request without a session", async () => {
		const caller = appRouter.createCaller(await createContextFactory(db)());

		await expect(caller.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("returns the signed-in user", async () => {
		const user = { id: "u1", email: "me@example.com", name: "Me" };
		const caller = appRouter.createCaller(
			await createContextFactory(db, () => Promise.resolve({ user }))()
		);

		await expect(caller.me()).resolves.toEqual(user);
	});
});
