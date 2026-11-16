import { describe, expect, it } from "vitest";

import { makeLabel, makeProject } from "../../__tests__/task-fixtures";
import { tokenAtCaret } from "../caret-token";
import { labelToken, suggestQuickAdd } from "../quick-add";

const projects = [
	makeProject({ id: "uni", name: "大学" }),
	makeProject({ id: "lab", name: "研究", parentId: "uni" }),
	makeProject({ id: "intern", name: "インターン研修" }),
	makeProject({ archived: true, id: "old", name: "研究会" }),
];
const labels = [
	makeLabel({ id: "next", name: "next" }),
	makeLabel({ id: "pc", name: "@PC" }),
	makeLabel({ id: "home", name: "@家" }),
];

const suggest = (text: string) =>
	suggestQuickAdd({
		labels,
		projects,
		token: tokenAtCaret(text, text.length, ["#", "@"]),
	});

describe("suggestQuickAdd", () => {
	it("offers open projects after #, names that start with the text first", () => {
		expect(suggest("論文 #研").map((item) => item.insert)).toEqual([
			"#研究",
			"#インターン研修",
		]);
		expect(suggest("#")).toHaveLength(3);
	});

	it("offers labels after @, with or without their own @", () => {
		expect(suggest("@p").map((item) => item.insert)).toEqual(["@PC"]);
		expect(suggest("@@家").map((item) => item.insert)).toEqual(["@家"]);
		expect(suggest("@N").map((item) => item.key)).toEqual(["label:next"]);
	});

	it("offers nothing outside a #word or @word", () => {
		expect(suggest("論文を読む")).toEqual([]);
		expect(suggest("#該当なし")).toEqual([]);
	});
});

describe("labelToken", () => {
	it("writes a label the way quick add reads it", () => {
		expect(labelToken(makeLabel({ name: "next" }))).toBe("@next");
		expect(labelToken(makeLabel({ name: "@PC" }))).toBe("@PC");
	});
});
