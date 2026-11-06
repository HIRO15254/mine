import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	clearOfflineData,
	rememberUser,
	savedUser,
	shouldSaveQuery,
	syncOnlineState,
} from "../offline";

function query(path: string[], status: "error" | "pending" | "success") {
	return { queryKey: [path, { type: "query" }], state: { status } } as never;
}

describe("offline storage", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("saves successful queries except tokens and connections", () => {
		expect(shouldSaveQuery(query(["task", "list"], "success"))).toBe(true);
		expect(shouldSaveQuery(query(["task", "list"], "error"))).toBe(false);
		expect(shouldSaveQuery(query(["token", "list"], "success"))).toBe(false);
		expect(shouldSaveQuery(query(["oauth", "connections"], "success"))).toBe(
			false
		);
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
