import { vi } from "vitest";

type Fn = (input: unknown) => Promise<unknown>;

function mutation(fn: Fn, path: string[] = []) {
	return {
		mutationKey: () => [path],
		mutationOptions: (options: Record<string, unknown> = {}) => ({
			...options,
			mutationFn: fn,
			mutationKey: [path],
		}),
	};
}

/** A query whose key the app also reads with queryKey() and pathKey(). */
function query(path: string[], fn: (input: unknown) => Promise<unknown>) {
	return {
		pathKey: () => [path],
		queryKey: (input?: unknown) =>
			input === undefined ? [path] : [path, { input }],
		queryOptions: (input?: unknown) => ({
			queryFn: () => fn(input),
			queryKey: input === undefined ? [path] : [path, { input }],
		}),
	};
}

/** A stand-in for the tRPC options proxy with spy-able mutations. */
export function createTrpcMock() {
	const calls = {
		create: vi.fn<Fn>((input) => Promise.resolve(input)),
		remove: vi.fn<Fn>((input) => Promise.resolve(input)),
		timeCreate: vi.fn<Fn>((input) => Promise.resolve(input)),
		timeStart: vi.fn<Fn>((input) => Promise.resolve(input)),
		timeStop: vi.fn<Fn>(() => Promise.resolve(null)),
		tokenCreate: vi.fn<Fn>((input) =>
			Promise.resolve({
				...(input as object),
				id: "t1",
				prefix: "mine_abcdef",
				token: "mine_abcdef-secret",
			})
		),
		update: vi.fn<Fn>((input) => Promise.resolve(input)),
	};
	/** What `time.current` returns; tests may replace it. */
	const state: {
		connections: unknown[];
		current: unknown;
		entries: unknown[];
		events: unknown[];
		projects: unknown[];
		tasks: unknown[];
		threads: unknown[];
		tokens: unknown[];
	} = {
		connections: [],
		current: null,
		entries: [],
		events: [],
		projects: [],
		tasks: [],
		threads: [],
		tokens: [],
	};
	const trpc = {
		calendar: {
			events: {
				queryOptions: (input: unknown) => ({
					queryFn: () =>
						Promise.resolve({ calendars: [], events: state.events }),
					queryKey: [["calendar", "events"], { input }],
				}),
			},
		},
		label: {
			list: query(["label", "list"], () => Promise.resolve([])),
			pathKey: () => [["label"]],
		},
		oauth: {
			connections: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve(state.connections),
					queryKey: [["oauth", "connections"]],
				}),
			},
			pathKey: () => [["oauth"]],
			revoke: mutation(calls.remove),
		},
		project: {
			list: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve(state.projects),
					queryKey: [["project", "list"]],
				}),
			},
			pathKey: () => [["project"]],
		},
		task: {
			complete: mutation(calls.update, ["task", "complete"]),
			create: mutation(calls.create, ["task", "create"]),
			delete: mutation(calls.remove, ["task", "delete"]),
			list: query(["task", "list"], () => Promise.resolve(state.tasks)),
			pathKey: () => [["task"]],
			uncomplete: mutation(calls.update, ["task", "uncomplete"]),
			update: mutation(calls.update, ["task", "update"]),
		},
		thread: {
			list: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve(state.threads),
					queryKey: [["thread", "list"]],
				}),
			},
			pathKey: () => [["thread"]],
			setStatus: mutation(calls.update),
		},
		time: {
			create: mutation(calls.timeCreate),
			current: query(["time", "current"], () => Promise.resolve(state.current)),
			delete: mutation(calls.remove),
			list: {
				queryOptions: (input: unknown) => ({
					queryFn: () => Promise.resolve(state.entries),
					queryKey: [["time", "list"], { input }],
				}),
			},
			pathKey: () => [["time"]],
			start: mutation(calls.timeStart),
			stop: mutation(calls.timeStop),
			update: mutation(calls.update),
		},
		token: {
			create: mutation(calls.tokenCreate),
			delete: mutation(calls.remove),
			list: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve(state.tokens),
					queryKey: [["token", "list"]],
				}),
			},
			pathKey: () => [["token"]],
		},
	};
	return { calls, state, trpc };
}

/** Shared instance: `vi.mock("@/utils/trpc", () => import("./trpc-mock"))`. */
export const trpcMock = createTrpcMock();
export const trpc = trpcMock.trpc;
