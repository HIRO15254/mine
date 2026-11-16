import { describe, expect, it } from "vitest";

import { moveActive, replaceToken, tokenAtCaret } from "../caret-token";

describe("tokenAtCaret", () => {
	it("finds the word being typed when it starts with a trigger", () => {
		expect(tokenAtCaret("本 @ne あと", 5, ["#", "@"])).toEqual({
			end: 5,
			query: "ne",
			start: 2,
			trigger: "@",
		});
	});

	it("reaches past the caret to the end of the word", () => {
		expect(tokenAtCaret("#研究", 2, ["#"])).toMatchObject({
			end: 3,
			query: "研",
			start: 0,
		});
	});

	it("is null for other words, after a space and in an empty box", () => {
		expect(tokenAtCaret("本 @ne", 6, ["#"])).toBeNull();
		expect(tokenAtCaret("#研究 ", 4, ["#"])).toBeNull();
		expect(tokenAtCaret("", 0, ["#"])).toBeNull();
	});
});

describe("replaceToken", () => {
	it("puts the completion and one space in place of the word", () => {
		expect(replaceToken("本 #研  明日", { end: 4, start: 2 }, "#研究")).toEqual(
			{ caret: 6, text: "本 #研究 明日" }
		);
	});
});

describe("moveActive", () => {
	it("walks the list and wraps around", () => {
		expect(moveActive("ArrowDown", -1, 3)).toBe(0);
		expect(moveActive("ArrowUp", -1, 3)).toBe(2);
		expect(moveActive("ArrowDown", 2, 3)).toBe(0);
		expect(moveActive("ArrowUp", 0, 3, "top")).toBe(1);
	});
});
