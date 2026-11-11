import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useToday, useTodayDate } from "../use-today";

describe("useToday", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("moves to the next day while the screen stays open", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 10, 11, 23, 59, 30));
		const { result } = renderHook(() => ({
			date: useTodayDate(),
			key: useToday(),
		}));
		expect(result.current.key).toBe("2026-11-11");
		const before = result.current.date;

		act(() => {
			vi.advanceTimersByTime(20_000);
		});
		// Still the 11th: the same Date object, so nothing refetches.
		expect(result.current.date).toBe(before);

		act(() => {
			vi.advanceTimersByTime(60_000);
		});
		expect(result.current.key).toBe("2026-11-12");
		expect(result.current.date.getDate()).toBe(12);
	});

	it("looks again when the tab comes back", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 10, 11, 9));
		const { result } = renderHook(() => useToday());

		vi.setSystemTime(new Date(2026, 10, 12, 7));
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		expect(result.current).toBe("2026-11-12");
	});
});
