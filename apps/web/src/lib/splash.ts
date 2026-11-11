/**
 * The launch animation lives in index.html so it shows before the app loads.
 * It plays for at least MIN_MS, then fades out and the first screen's content
 * rises in (`app-enter` in index.css).
 */
const MIN_MS = 1500;
const OUT_MS = 450;
const ENTER_MS = 900;

declare global {
	interface Window {
		__splashStart?: number;
	}
}

let done = false;

export function hideSplash(): void {
	const splash = document.getElementById("splash");
	if (done || !splash) {
		return;
	}
	done = true;
	const shown = performance.now() - (window.__splashStart ?? 0);
	window.setTimeout(
		() => {
			splash.classList.add("sp-out");
			const root = document.documentElement;
			root.classList.add("app-enter");
			window.setTimeout(() => splash.remove(), OUT_MS + 50);
			window.setTimeout(
				() => root.classList.remove("app-enter"),
				OUT_MS + ENTER_MS
			);
		},
		Math.max(0, MIN_MS - shown)
	);
}
