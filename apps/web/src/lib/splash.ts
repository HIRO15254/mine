/**
 * The launch animation lives in index.html so it shows before the app loads.
 * It plays for at least MIN_MS, then the screen opens from the middle onto the
 * app and the first screen's content rises in (`app-enter` in index.css).
 * With reduced motion there is nothing to watch, so it only waits REDUCED_MS
 * and fades.
 */
export const MIN_MS = 1800;
export const REDUCED_MS = 300;
const OUT_MS = 700;
const REDUCED_OUT_MS = 300;
const ENTER_MS = 900;

declare global {
	interface Window {
		__splashStart?: number;
	}
}

let done = false;

function reducedMotion(): boolean {
	return (
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
	);
}

export function hideSplash(): void {
	const splash = document.getElementById("splash");
	if (done || !splash) {
		return;
	}
	done = true;
	const reduced = reducedMotion();
	const outMs = reduced ? REDUCED_OUT_MS : OUT_MS;
	const shown = performance.now() - (window.__splashStart ?? 0);
	window.setTimeout(
		() => {
			splash.classList.add("sp-out");
			const root = document.documentElement;
			root.classList.add("app-enter");
			window.setTimeout(() => splash.remove(), outMs + 50);
			window.setTimeout(
				() => root.classList.remove("app-enter"),
				outMs + ENTER_MS
			);
		},
		Math.max(0, (reduced ? REDUCED_MS : MIN_MS) - shown)
	);
}

/** For tests: lets hideSplash run again. */
export function resetSplashForTest(): void {
	done = false;
}
