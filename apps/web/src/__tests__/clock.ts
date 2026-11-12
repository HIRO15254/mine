import { vi } from "vitest";

/** 2026-11-10 (Tue) 14:20 in Tokyo: the instant the screenshots are taken at. */
export const NOW = Date.parse("2026-11-10T14:20:00+09:00");
export const TODAY = "2026-11-10";

/**
 * Stops `Date` at `now` for the rest of the test. Timers keep running for
 * real, so waiting and user events behave as usual; only the clock stands
 * still, and elapsed times come out exact.
 */
export function freezeNow(now: number = NOW) {
	vi.useFakeTimers({ now, toFake: ["Date"] });
}
