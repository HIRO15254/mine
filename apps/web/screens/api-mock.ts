import { queries, session, user } from "./fixtures";

export const API_ORIGIN = "http://api.screens.test";

export interface MockResponse {
	body: unknown;
	status: number;
}

/**
 * Answers the requests the web app sends to the API, from the fixtures:
 * Better Auth's session lookup and batched tRPC calls. `signedIn: false`
 * answers the session lookup as signed out, for the login screen.
 */
export function answer(
	url: URL,
	method: string,
	body: string | null,
	options: { signedIn: boolean; unknown: Set<string> }
): MockResponse {
	if (url.pathname === "/api/auth/get-session") {
		return { body: options.signedIn ? { session, user } : null, status: 200 };
	}
	if (!url.pathname.startsWith("/trpc/")) {
		return { body: { error: "not mocked" }, status: 404 };
	}
	const paths = decodeURIComponent(url.pathname.slice("/trpc/".length)).split(
		","
	);
	const raw = method === "GET" ? url.searchParams.get("input") : body;
	const inputs = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
	const results = paths.map((path, index) => {
		const query = queries[path];
		if (method !== "GET") {
			return { result: { data: null } };
		}
		if (!query) {
			options.unknown.add(path);
			return { result: { data: null } };
		}
		return { result: { data: query(inputs[index]) } };
	});
	return {
		body: url.searchParams.has("batch") ? results : results[0],
		status: 200,
	};
}
