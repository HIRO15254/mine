import { useState } from "react";
import { vi } from "vitest";

/** Stand-in for virtual:pwa-register/react; tests set `pwaState.waiting`. */
export const pwaState = {
	update: vi.fn<(reload?: boolean) => Promise<void>>(() => Promise.resolve()),
	waiting: false,
};

export function useRegisterSW() {
	const needRefresh = useState(pwaState.waiting);
	const offlineReady = useState(false);
	return {
		needRefresh,
		offlineReady,
		updateServiceWorker: pwaState.update,
	};
}
