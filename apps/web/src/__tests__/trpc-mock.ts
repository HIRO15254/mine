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
		approve: vi.fn<Fn>(() =>
			Promise.resolve({
				redirectUrl: "https://claude.ai/api/mcp/auth_callback?code=c",
			})
		),
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
		client: unknown;
		connections: unknown[];
		current: unknown;
		tokens: unknown[];
	} = {
		client: { name: "Claude", redirectHost: "claude.ai" },
		connections: [],
		current: null,
		tokens: [],
	};
	const trpc = {
		label: { pathKey: () => [["label"]] },
		oauth: {
			approve: mutation(calls.approve),
			client: {
				queryOptions: (_input: unknown, options: object = {}) => ({
					...options,
					queryFn: () =>
						state.client
							? Promise.resolve(state.client)
							: Promise.reject(new Error("BAD_REQUEST")),
					queryKey: [["oauth", "client"]],
				}),
			},
			connections: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve(state.connections),
					queryKey: [["oauth", "connections"]],
				}),
			},
			pathKey: () => [["oauth"]],
			revoke: mutation(calls.remove),
		},
		project: { pathKey: () => [["project"]] },
		task: {
			complete: mutation(calls.update),
			create: mutation(calls.create),
			delete: mutation(calls.remove),
			pathKey: () => [["task"]],
			uncomplete: mutation(calls.update),
			update: mutation(calls.update),
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
