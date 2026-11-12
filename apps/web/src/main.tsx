import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { RouteError, RouteNotFound } from "./components/app-shell/route-error";
import {
	CACHE_MAX_AGE,
	CACHE_VERSION,
	queryPersister,
	shouldSaveQuery,
	syncOnlineState,
} from "./lib/offline";
import { hideSplash } from "./lib/splash";
import { queryClient, trpc } from "./lib/trpc";
import { routeTree } from "./routeTree.gen";

syncOnlineState();

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	defaultErrorComponent: RouteError,
	defaultNotFoundComponent: RouteNotFound,
	context: { trpc, queryClient },
	Wrap: ({ children }) => (
		<PersistQueryClientProvider
			client={queryClient}
			persistOptions={{
				buster: CACHE_VERSION,
				dehydrateOptions: {
					// A write still under way is not saved: resuming it later would
					// need its function again, and nothing registers one.
					shouldDehydrateMutation: () => false,
					shouldDehydrateQuery: (query) => shouldSaveQuery(query),
				},
				maxAge: CACHE_MAX_AGE,
				persister: queryPersister,
			}}
		>
			{children}
		</PersistQueryClientProvider>
	),
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("app");
if (!rootElement) {
	throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);

// The launch animation leaves once the first screen has loaded.
const stopWaiting = router.subscribe("onResolved", () => {
	stopWaiting();
	hideSplash();
});
window.setTimeout(hideSplash, 6000);
