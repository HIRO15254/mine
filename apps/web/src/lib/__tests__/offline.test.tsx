import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	clearOfflineData,
	rememberUser,
	savedUser,
	shouldSaveQuery,
	syncOnlineState,
} from "../offline";

const NOW = Date.UTC(2026, 10, 11);

function query(
	path: string[],
	status: "error" | "pending" | "success",
	dataUpdatedAt = NOW
) {
	return {
		queryKey: [path, { type: "query" }],
		state: { dataUpdatedAt, status },
	} as never;
}

describe("offline storage", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("saves successful queries except tokens and connections", () => {
		const saves = (...args: Parameters<typeof query>) =>
			shouldSaveQuery(query(...args), NOW);
		expect(saves(["task", "list"], "success")).toBe(true);
		expect(saves(["task", "list"], "error")).toBe(false);
		expect(saves(["token", "list"], "success")).toBe(false);
		expect(saves(["oauth", "connections"], "success")).toBe(false);
	});

	it("leaves out data nobody has refreshed for a week", () => {
		const DAY = 86_400_000;
		expect(
			shouldSaveQuery(query(["time", "list"], "success", NOW - 6 * DAY), NOW)
		).toBe(true);
		expect(
			shouldSaveQuery(query(["time", "list"], "success", NOW - 8 * DAY), NOW)
		).toBe(false);
	});

	it("starts React Query offline when the browser is", () => {
		const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
		syncOnlineState();
		expect(onlineManager.isOnline()).toBe(false);
		spy.mockReturnValue(true);
		syncOnlineState();
		expect(onlineManager.isOnline()).toBe(true);
		spy.mockRestore();
	});

	it("remembers the signed-in user until sign-out", () => {
		expect(savedUser()).toBeNull();
		rememberUser({
			email: "me@example.com",
			id: "u1",
			name: "Me",
		});
		expect(savedUser()).toEqual({
			email: "me@example.com",
			id: "u1",
			image: null,
			name: "Me",
		});
		localStorage.setItem("mine-query-cache", "{}");
		clearOfflineData();
		expect(savedUser()).toBeNull();
		expect(localStorage.getItem("mine-query-cache")).toBeNull();
	});

	it("ignores a broken saved user", () => {
		localStorage.setItem("mine-user", "{");
		expect(savedUser()).toBeNull();
	});
});
