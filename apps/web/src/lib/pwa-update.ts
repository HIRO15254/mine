import { useRegisterSW } from "virtual:pwa-register/react";

/** How often an open app asks the server for a new deploy. */
const CHECK_EVERY = 30 * 60_000;

/**
 * Registers the service worker and reports when a new deploy has been
 * downloaded and is waiting. It looks for one every 30 minutes and whenever
 * the installed app comes back to the foreground.
 */
export function useAppUpdate() {
	const {
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegisteredSW(_url, registration) {
			if (!registration) {
				return;
			}
			const check = () => {
				if (registration.installing || !navigator.onLine) {
					return;
				}
				registration.update().catch(() => undefined);
			};
			window.setInterval(check, CHECK_EVERY);
			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "visible") {
					check();
				}
			});
		},
	});
	return {
		dismiss: () => setNeedRefresh(false),
		needRefresh,
		/** Activates the waiting version and reloads the page. */
		update: () => updateServiceWorker(true),
	};
}
