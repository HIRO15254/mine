import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import {
	CACHE_MAX_AGE,
	queryPersister,
	shouldSaveQuery,
	syncOnlineState,
} from "./lib/offline";
import { hideSplash } from "./lib/splash";
import { routeTree } from "./routeTree.gen";
import { queryClient, trpc } from "./utils/trpc";

syncOnlineState();

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	context: { trpc, queryClient },
	Wrap: ({ children }) => (
		<PersistQueryClientProvider
			client={queryClient}
			persistOptions={{
				dehydrateOptions: { shouldDehydrateQuery: shouldSaveQuery },
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
