import { describe, expect, it } from "vitest";

import { isEmailAllowed, parseAllowedEmails } from "../allowlist";

describe("parseAllowedEmails", () => {
	it("splits, trims and lowercases a comma-separated list", () => {
		expect(parseAllowedEmails(" Me@Example.com, other@example.com ,")).toEqual([
			"me@example.com",
			"other@example.com",
		]);
	});

	it("returns an empty list when the variable is unset", () => {
		expect(parseAllowedEmails(undefined)).toEqual([]);
		expect(parseAllowedEmails("")).toEqual([]);
	});
});

describe("isEmailAllowed", () => {
	it("accepts a listed email regardless of case", () => {
		expect(isEmailAllowed("ME@example.com", ["me@example.com"])).toBe(true);
	});

	it("rejects everyone when the list is empty", () => {
		expect(isEmailAllowed("me@example.com", [])).toBe(false);
	});

	it("rejects an unlisted email", () => {
		expect(isEmailAllowed("someone@example.com", ["me@example.com"])).toBe(
			false
		);
	});
});
