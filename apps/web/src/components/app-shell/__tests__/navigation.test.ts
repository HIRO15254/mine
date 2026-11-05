import { describe, expect, it } from "vitest";

import { isActive, MOBILE_ITEMS, PRIMARY_ITEMS } from "../navigation";

describe("isActive", () => {
	it("matches the home item only on the exact path", () => {
		expect(isActive("/", { to: "/", exact: true })).toBe(true);
		expect(isActive("/tasks", { to: "/", exact: true })).toBe(false);
	});

	it("matches nested paths under a section", () => {
		expect(isActive("/tasks", { to: "/tasks" })).toBe(true);
		expect(isActive("/tasks/123", { to: "/tasks" })).toBe(true);
		expect(isActive("/tasksx", { to: "/tasks" })).toBe(false);
	});
});

describe("navigation items", () => {
	it("keeps the mobile tab bar to five items", () => {
		expect(MOBILE_ITEMS).toHaveLength(5);
		expect(MOBILE_ITEMS.slice(0, PRIMARY_ITEMS.length)).toEqual(PRIMARY_ITEMS);
	});
});
