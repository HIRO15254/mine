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
		update: vi.fn<Fn>((input) => Promise.resolve(input)),
	};
	/** What `time.current` returns; tests may replace it. */
	const state: { current: unknown } = { current: null };
	const trpc = {
		label: { pathKey: () => [["label"]] },
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
	};
	return { calls, state, trpc };
}

/** Shared instance: `vi.mock("@/utils/trpc", () => import("./trpc-mock"))`. */
export const trpcMock = createTrpcMock();
export const trpc = trpcMock.trpc;
