/**
 * Test support for every package: the real routers on an in-memory SQLite
 * database with the real migrations applied. Import it from tests only
 * (`@mine/api/testing`); nothing the Worker bundles may depend on it.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SQLInputValue } from "node:sqlite";
import { createDb, type D1Database } from "@mine/db";

import {
	type ContextOptions,
	createContextFactory,
	type Session,
	type SessionUser,
} from "./context";
import { appRouter, type Caller } from "./routers/index";

// Asked of Node directly: Vite cannot resolve node:sqlite for the jsdom tests.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite");

const MIGRATIONS_DIR = path.resolve(
	import.meta.dirname,
	"../../db/src/migrations"
);

/** Minimal D1 stand-in over node:sqlite, with the real migrations applied. */
export function createTestDb() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec("PRAGMA foreign_keys = ON");
	for (const file of readdirSync(MIGRATIONS_DIR)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		for (const statement of readFileSync(
			path.join(MIGRATIONS_DIR, file),
			"utf8"
		).split("--> statement-breakpoint")) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}

	const prepare = (query: string) => {
		let params: SQLInputValue[] = [];
		const statement = {
			bind(...values: SQLInputValue[]) {
				params = values;
				return statement;
			},
			all() {
				const results = sqlite.prepare(query).all(...params);
				return Promise.resolve({ results, success: true, meta: {} });
			},
			raw() {
				const stmt = sqlite.prepare(query);
				stmt.setReturnArrays(true);
				return Promise.resolve(stmt.all(...params));
			},
			run() {
				const meta = sqlite.prepare(query).run(...params);
				return Promise.resolve({ results: [], success: true, meta });
			},
			first() {
				return Promise.resolve(sqlite.prepare(query).get(...params) ?? null);
			},
		};
		return statement;
	};

	/**
	 * Like D1: the statements run in one transaction, all or nothing, and
	 * nothing else runs between them (node:sqlite is synchronous underneath).
	 */
	const batch = (statements: ReturnType<typeof prepare>[]) => {
		sqlite.exec("BEGIN");
		try {
			const results = statements.map((statement) => statement.all());
			sqlite.exec("COMMIT");
			return Promise.all(results);
		} catch (error) {
			sqlite.exec("ROLLBACK");
			return Promise.reject(error);
		}
	};

	const d1 = { batch, prepare } as unknown as D1Database;
	return { d1, db: createDb(d1), sqlite };
}

/** The user every test signs in as unless it asks for another. */
export const TEST_USER: SessionUser = {
	email: "me@example.com",
	id: "u1",
	name: "Me",
};

/** A second user, for checking that one user cannot reach another's rows. */
export const OTHER_USER: SessionUser = {
	email: "other@example.com",
	id: "u2",
	name: "Other",
};

export interface TestAppOptions extends Omit<ContextOptions, "now"> {
	/** Fixes the server's clock; `clock.now` moves it. Defaults to the real one. */
	now?: number;
	/** Rows for the `user` table. Defaults to TEST_USER and OTHER_USER. */
	users?: SessionUser[];
}

/**
 * A database with users in it and callers for them. `caller` is TEST_USER
 * signed in through the browser; `callerFor` signs in anyone, and with `via`
 * as a token.
 */
export async function createTestApp(options: TestAppOptions = {}) {
	const { now, users = [TEST_USER, OTHER_USER], ...context } = options;
	const { d1, db, sqlite } = createTestDb();
	const insert = sqlite.prepare(
		"insert into user (id, name, email) values (?, ?, ?)"
	);
	for (const user of users) {
		insert.run(user.id, user.name, user.email);
	}
	let fixed = now;
	/** The server's clock: the real one until a test sets or moves it. */
	const clock = {
		get now() {
			return fixed ?? Date.now();
		},
		set now(value: number) {
			fixed = value;
		},
	};
	const contextFor = (session: Session | null) =>
		createContextFactory(db, () => Promise.resolve(session), {
			...context,
			now: () => clock.now,
		});
	const callerWith = async (session: Session | null): Promise<Caller> =>
		appRouter.createCaller(await contextFor(session)());
	const callerFor = (user: SessionUser = TEST_USER, via?: Session["via"]) =>
		callerWith(via ? { user, via } : { user });
	return {
		caller: await callerFor(users[0]),
		callerFor,
		callerWith,
		clock,
		contextFor,
		d1,
		db,
		sqlite,
		/** The user `caller` is signed in as. */
		user: users[0] ?? TEST_USER,
	};
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
