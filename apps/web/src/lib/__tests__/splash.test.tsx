import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hideSplash, MIN_MS, REDUCED_MS, resetSplashForTest } from "../splash";

function mountSplash(): HTMLElement {
	const splash = document.createElement("div");
	splash.id = "splash";
	document.body.append(splash);
	window.__splashStart = performance.now();
	return splash;
}

function preferReducedMotion(reduce: boolean): void {
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			matches: reduce && query === "(prefers-reduced-motion: reduce)",
		}))
	);
}

describe("hideSplash", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		resetSplashForTest();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		document.getElementById("splash")?.remove();
		document.documentElement.classList.remove("app-enter");
	});

	it("lets the launch play out before the screen opens onto the app", () => {
		preferReducedMotion(false);
		const splash = mountSplash();

		hideSplash();
		vi.advanceTimersByTime(MIN_MS - 100);
		expect(splash.classList.contains("sp-out")).toBe(false);

		vi.advanceTimersByTime(100);
		expect(splash.classList.contains("sp-out")).toBe(true);
		expect(document.documentElement.classList.contains("app-enter")).toBe(true);

		vi.advanceTimersByTime(800);
		expect(splash.isConnected).toBe(false);
		vi.advanceTimersByTime(1000);
		expect(document.documentElement.classList.contains("app-enter")).toBe(
			false
		);
	});

	it("does not hold the app back when motion is reduced", () => {
		preferReducedMotion(true);
		const splash = mountSplash();

		hideSplash();
		vi.advanceTimersByTime(REDUCED_MS);
		expect(splash.classList.contains("sp-out")).toBe(true);
		vi.advanceTimersByTime(400);
		expect(splash.isConnected).toBe(false);
	});

	it("runs once even when called again", () => {
		preferReducedMotion(false);
		const splash = mountSplash();
		const remove = vi.spyOn(splash, "remove");

		hideSplash();
		hideSplash();
		vi.runAllTimers();
		expect(remove).toHaveBeenCalledTimes(1);
	});
});
