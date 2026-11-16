import { focusManager } from "@tanstack/react-query";

/**
 * React Query refetches stale data when the page becomes visible again, but
 * coming back to a window that stayed visible (from Claude in another window,
 * say) only fires `focus`. Listening to both brings changes made elsewhere
 * in as soon as the person looks at Mine again.
 */
export function refetchOnWindowFocus() {
	focusManager.setEventListener((handleFocus) => {
		if (typeof window === "undefined") {
			return;
		}
		const target = window;
		// No argument: React Query reads the page's visibility itself.
		const listener = () => handleFocus();
		target.addEventListener("visibilitychange", listener, false);
		target.addEventListener("focus", listener, false);
		return () => {
			target.removeEventListener("visibilitychange", listener);
			target.removeEventListener("focus", listener);
		};
	});
}
