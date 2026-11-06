import type { AppRouter } from "@mine/api/routers/index";
import { env } from "@mine/env/web";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { CACHE_MAX_AGE } from "@/lib/offline";

export const queryClient = new QueryClient({
	// Kept long enough to be saved for offline use.
	defaultOptions: { queries: { gcTime: CACHE_MAX_AGE, retry: 1 } },
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
