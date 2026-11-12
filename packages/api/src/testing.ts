/**
 * Test support for every package: the real routers on an in-memory SQLite
 * database with the real migrations applied. Import it from tests only
 * (`@mine/api/testing`); nothing the Worker bundles may depend on it.
 */
import { createTestDb } from "@mine/db/testing";

import {
	type ContextOptions,
	createContextFactory,
	type Session,
	type SessionUser,
} from "./context";
import { appRouter, type Caller } from "./routers/index";

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
