import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { onlineManager, type Query } from "@tanstack/react-query";

/** Keys in localStorage; cleared on sign-out. */
const CACHE_KEY = "mine-query-cache";
const USER_KEY = "mine-user";

/** How long a saved copy may be shown while offline. */
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Token and connection lists are only needed online. */
const SKIPPED_ROUTERS = new Set(["token", "oauth"]);

function storage(): Storage | undefined {
	try {
		return typeof window === "undefined" ? undefined : window.localStorage;
	} catch {
		return undefined;
	}
}

export const queryPersister = createSyncStoragePersister({
	key: CACHE_KEY,
	storage: storage(),
	throttleTime: 2000,
});

export function shouldSaveQuery(query: Pick<Query, "queryKey" | "state">) {
	const [path] = query.queryKey as [unknown];
	const router = Array.isArray(path) ? path[0] : undefined;
	return (
		query.state.status === "success" &&
		!(typeof router === "string" && SKIPPED_ROUTERS.has(router))
	);
}

/**
 * React Query assumes it starts online and only learns otherwise from an
 * offline event, so an app opened offline would fail every query instead of
 * waiting for the network.
 */
export function syncOnlineState() {
	if (typeof navigator !== "undefined") {
		onlineManager.setOnline(navigator.onLine);
	}
}

export interface SavedUser {
	email: string;
	id: string;
	image?: string | null;
	name: string;
}

export function rememberUser(user: SavedUser) {
	try {
		storage()?.setItem(
			USER_KEY,
			JSON.stringify({
				email: user.email,
				id: user.id,
				image: user.image ?? null,
				name: user.name,
			})
		);
	} catch {
		// Storage can be full or blocked; offline start just won't work.
	}
}

export function savedUser(): SavedUser | null {
	try {
		const value = storage()?.getItem(USER_KEY);
		return value ? (JSON.parse(value) as SavedUser) : null;
	} catch {
		return null;
	}
}

/** Forgets everything kept for offline use. */
export function clearOfflineData() {
	try {
		storage()?.removeItem(USER_KEY);
		storage()?.removeItem(CACHE_KEY);
	} catch {
		// Nothing to clear.
	}
}

export function isOffline(): boolean {
	return typeof navigator !== "undefined" && navigator.onLine === false;
}
