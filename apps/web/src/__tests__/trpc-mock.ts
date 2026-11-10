import { vi } from "vitest";

type Fn = (input: unknown) => Promise<unknown>;

function mutation(fn: Fn) {
	return {
		mutationOptions: (options: Record<string, unknown> = {}) => ({
			...options,
			mutationFn: fn,
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
			list: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve([]),
					queryKey: [["label", "list"]],
				}),
			},
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
			complete: mutation(calls.update),
			create: mutation(calls.create),
			delete: mutation(calls.remove),
			list: {
				queryOptions: (input: unknown) => ({
					queryFn: () => Promise.resolve(state.tasks),
					queryKey: [["task", "list"], { input }],
				}),
			},
			pathKey: () => [["task"]],
			uncomplete: mutation(calls.update),
			update: mutation(calls.update),
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
			current: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve(state.current),
					queryKey: [["time", "current"]],
				}),
			},
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
