import type { AppRouter } from "@mine/api/routers/index";
import { env } from "@mine/env/web";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

export const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: 1 } },
});

export const trpcClient = createTRPCClient<AppRouter>({
	links: [httpBatchLink({ url: `${env.VITE_SERVER_URL}/trpc` })],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
});
