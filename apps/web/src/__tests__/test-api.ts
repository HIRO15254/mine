/**
 * The web app's tRPC client for tests: the real routers on an in-memory
 * database, so a component test fails when it calls a procedure that does
 * not exist or sends input the server refuses.
 *
 *   vi.mock("@/utils/trpc", () => import("<path>/__tests__/test-api"));
 *   beforeEach(() => api.reset());
 *
 * Seed and inspect data through `api.caller`, read what the app sent with
 * `api.calls(path)`, and replace an answer with `api.stub` or `api.fail`.
 */
import type { AppRouter } from "@mine/api/routers/index";
import { appRouter } from "@mine/api/routers/index";
import { createTestApp, type TestApp } from "@mine/api/testing";
import { QueryClient } from "@tanstack/react-query";
import {
	createTRPCClient,
	TRPCClientError,
	type TRPCLink,
	unstable_localLink,
} from "@trpc/client";
import type {
	AnyProcedure,
	inferProcedureInput,
	inferProcedureOutput,
} from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

type Leaves<T, Prefix extends string = ""> = {
	[K in keyof T & string]: T[K] extends AnyProcedure
		? { path: `${Prefix}${K}`; procedure: T[K] }
		: Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
type Leaf = Leaves<AppRouter["_def"]["record"]>;

/** "task.create", "time.start", ... */
export type ProcedurePath = Leaf["path"];
type ProcedureAt<P extends ProcedurePath> = Extract<
	Leaf,
	{ path: P }
>["procedure"];
export type InputOf<P extends ProcedurePath> = inferProcedureInput<
	ProcedureAt<P>
>;
export type OutputOf<P extends ProcedurePath> = inferProcedureOutput<
	ProcedureAt<P>
>;

type Stub = (input: unknown) => unknown;

let app: TestApp = await createTestApp();
const sent: Array<{ input: unknown; path: string }> = [];
const stubs = new Map<string, Stub>();

/** Google Calendar is not reachable from tests: no calendars, no events. */
function stubGoogle() {
	stubs.set("calendar.calendars", () => []);
	stubs.set("calendar.events", () => ({ calendars: [], events: [] }));
}
stubGoogle();

export const api = {
	/** Every input the app sent to `path`, oldest first. */
	calls<P extends ProcedurePath>(path: P): InputOf<P>[] {
		return sent
			.filter((call) => call.path === path)
			.map((call) => call.input as InputOf<P>);
	},
	/** The signed-in user's server-side caller, for seeding and checking. */
	get caller() {
		return app.caller;
	},
	/** The client the app uses: answers in the shapes that arrive over HTTP. */
	get client() {
		return trpcClient;
	},
	/** The server's clock; it follows `Date.now()` until a test sets it. */
	get clock() {
		return app.clock;
	},
	/** Makes `path` fail as the server would, after `delayMs` if given. */
	fail(path: ProcedurePath, delayMs = 0) {
		stubs.set(
			path,
			() =>
				new Promise((_resolve, reject) => {
					setTimeout(() => reject(new Error(`${path} refused`)), delayMs);
				})
		);
	},
	/** A fresh database with the test users and nothing else. */
	async reset() {
		app = await createTestApp();
		sent.length = 0;
		stubs.clear();
		stubGoogle();
	},
	get sqlite() {
		return app.sqlite;
	},
	/** Answers `path` without the server, for what the database cannot hold. */
	stub<P extends ProcedurePath>(
		path: P,
		answer: (input: InputOf<P>) => OutputOf<P> | Promise<OutputOf<P>>
	) {
		stubs.set(path, answer as Stub);
	},
};

/** Records every call, and answers the stubbed ones the way HTTP would. */
const tap: TRPCLink<AppRouter> =
	() =>
	({ next, op }) => {
		sent.push({ input: op.input, path: op.path });
		const stub = stubs.get(op.path);
		if (!stub) {
			return next(op);
		}
		return observable((observer) => {
			Promise.resolve()
				.then(() => stub(op.input))
				.then(
					(data) => {
						observer.next({
							result: {
								data: data === undefined ? data : structuredJson(data),
							},
						});
						observer.complete();
					},
					(cause) => observer.error(TRPCClientError.from(cause as Error))
				);
		});
	};

/** What survives the trip over HTTP: dates become strings, undefined goes. */
function structuredJson(value: unknown): unknown {
	return JSON.parse(JSON.stringify(value));
}

export const queryClient = new QueryClient();

export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		tap,
		unstable_localLink({
			createContext: () => app.contextFor({ user: app.user })(),
			router: appRouter,
		}),
	],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
});

export function isConflict(error: unknown): boolean {
	return error instanceof TRPCClientError && error.data?.code === "CONFLICT";
}
