import type { AppRouter } from "@mine/api/routers/index";
import { env } from "@mine/env/web";
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import { CACHE_MAX_AGE, isOffline } from "@/lib/offline";

export const queryClient = new QueryClient({
	defaultOptions: {
		// Offline, a write fails at once and the screen goes back. Left to wait
		// for the network it would look saved and be lost with the tab.
		mutations: { networkMode: "always" },
		// Kept long enough to be saved for offline use.
		queries: { gcTime: CACHE_MAX_AGE, retry: 1 },
	},
	mutationCache: new MutationCache({
		// A write that says nothing of its own failure still must not fail unseen.
		onError: (_error, _input, _context, mutation) => {
			if (!mutation.options.onError) {
				toast.error(
					isOffline()
						? "オフラインのため保存できませんでした"
						: "保存できませんでした"
				);
			}
		},
	}),
});

export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${env.VITE_SERVER_URL}/trpc`,
			// The API is on another origin, so the session cookie must be sent explicitly.
			fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
		}),
	],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
});

/** True when the server refused a write because of what is already there. */
export function isConflict(error: unknown): boolean {
	return error instanceof TRPCClientError && error.data?.code === "CONFLICT";
}
