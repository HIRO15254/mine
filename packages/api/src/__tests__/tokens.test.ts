import { describe, expect, it } from "vitest";

import { createContextFactory, type Session } from "../context";
import { appRouter } from "../routers/index";
import {
	bearerToken,
	generateToken,
	hashToken,
	resolveTokenSession,
	tokenPrefix,
} from "../tokens";
import { createTestDb } from "./d1";

const TOKEN_FORMAT = /^mine_[\w-]{43}$/;
const HEX_64 = /^[0-9a-f]{64}$/;

async function setup() {
	const { db, sqlite } = createTestDb();
	sqlite
		.prepare("insert into user (id, name, email) values (?, ?, ?)")
		.run("u1", "Me", "me@example.com");
	const callerWith = async (session: Session) =>
		appRouter.createCaller(
			await createContextFactory(db, () => Promise.resolve(session))()
		);
	const browser = await callerWith({
		user: { email: "me@example.com", id: "u1", name: "Me" },
	});
	return { browser, callerWith, db };
}

describe("token helpers", () => {
	it("generates, hashes and reads tokens", async () => {
		const token = generateToken();
		expect(token).toMatch(TOKEN_FORMAT);
		expect(tokenPrefix(token)).toBe(token.slice(0, 11));
		expect(await hashToken(token)).toMatch(HEX_64);
		expect(bearerToken(`Bearer ${token}`)).toBe(token);
		expect(bearerToken(`bearer  ${token} `)).toBe(token);
		expect(bearerToken("Bearer abc")).toBeNull();
		expect(bearerToken(token)).toBeNull();
		expect(bearerToken(null)).toBeNull();
	});
});

describe("token router", () => {
	it("issues a token that signs in as its owner", async () => {
		const { browser, callerWith, db } = await setup();

		const created = await browser.token.create({ name: "HTTP Shortcuts" });
		expect(created.token.startsWith(created.prefix)).toBe(true);
		expect(await browser.token.list()).toEqual([
			expect.objectContaining({
				id: created.id,
				lastUsedAt: null,
				name: "HTTP Shortcuts",
				prefix: created.prefix,
			}),
		]);
		expect(JSON.stringify(await browser.token.list())).not.toContain(
			created.token
		);

		const session = await resolveTokenSession(
			db,
			created.token,
			new Date("2026-11-06T00:00:00Z")
		);
		expect(session).toEqual({
			user: { email: "me@example.com", id: "u1", name: "Me" },
			via: "api-token",
		});
		const [listed] = await browser.token.list();
		expect(listed?.lastUsedAt).toEqual(new Date("2026-11-06T00:00:00Z"));
		await expect(resolveTokenSession(db, generateToken())).resolves.toBeNull();

		const app = await callerWith(session as Session);
		await expect(app.time.current()).resolves.toBeNull();
		await expect(app.token.list()).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		await expect(app.token.create({ name: "x" })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});

		await browser.token.delete({ id: created.id });
		await expect(resolveTokenSession(db, created.token)).resolves.toBeNull();
		await expect(
			browser.token.delete({ id: created.id })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
