import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

export function renderWithQuery(element: ReactElement) {
	const client = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>{element}</QueryClientProvider>
	);
}

/** Makes `useIsDesk` report the desktop layout. */
export function useDesktopLayout() {
	window.matchMedia = ((query: string) => ({
		addEventListener: () => undefined,
		// The older pair, which next-themes still calls.
		addListener: () => undefined,
		matches: true,
		media: query,
		removeEventListener: () => undefined,
		removeListener: () => undefined,
	})) as unknown as typeof window.matchMedia;
}
