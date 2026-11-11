import { authClient } from "./auth-client";
import type { SavedUser } from "./offline";

/**
 * What asking the API about the session can tell: someone is signed in,
 * nobody is, or no answer came (offline, a timeout, a server error). Only a
 * clear "nobody" may send the person to the sign-in screen.
 */
export type SessionCheck =
	| { state: "signed-in"; user: SavedUser }
	| { state: "signed-out" }
	| { state: "unknown" };

/** A confirmed session is not asked about again for this long. */
const FRESH_FOR = 5 * 60_000;
/** A check that takes longer than this counts as unanswered. */
const TIMEOUT = 8000;

let confirmed: { at: number; user: SavedUser } | null = null;

export async function checkSession(now = Date.now()): Promise<SessionCheck> {
	if (confirmed && now - confirmed.at < FRESH_FOR) {
		return { state: "signed-in", user: confirmed.user };
	}
	try {
		const { data, error } = await authClient.getSession({
			fetchOptions: { signal: AbortSignal.timeout(TIMEOUT) },
		});
		if (data) {
			confirmed = { at: now, user: data.user };
			return { state: "signed-in", user: data.user };
		}
		if (error) {
			return { state: "unknown" };
		}
		confirmed = null;
		return { state: "signed-out" };
	} catch {
		return { state: "unknown" };
	}
}

/** Makes the next check ask the API again, e.g. after signing out. */
export function forgetSession() {
	confirmed = null;
}
