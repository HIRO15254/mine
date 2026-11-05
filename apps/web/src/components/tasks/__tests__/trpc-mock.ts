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
		update: vi.fn<Fn>((input) => Promise.resolve(input)),
	};
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
	};
	return { calls, trpc };
}

/** Shared instance: `vi.mock("@/utils/trpc", () => import("./trpc-mock"))`. */
export const trpcMock = createTrpcMock();
export const trpc = trpcMock.trpc;
