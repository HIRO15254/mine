import { describe, expect, it } from "vitest";

import { quickAddText } from "../share";

describe("quickAddText", () => {
	it("is undefined without share or add parameters", () => {
		expect(quickAddText({})).toBeUndefined();
	});

	it("keeps an empty add so the shortcut still opens the box", () => {
		expect(quickAddText({ add: "" })).toBe("");
		expect(quickAddText({ add: "牛乳を買う" })).toBe("牛乳を買う");
		expect(quickAddText({ add: 123 })).toBe("123");
	});

	it("joins the shared title, text and link once each", () => {
		expect(
			quickAddText({
				text: "記事のタイトル https://example.com/a",
				title: "記事のタイトル",
				url: "https://example.com/a",
			})
		).toBe("記事のタイトル https://example.com/a");
		expect(
			quickAddText({ text: "あとで読む", url: "https://example.com/b" })
		).toBe("あとで読む https://example.com/b");
	});

	it("flattens line breaks", () => {
		expect(quickAddText({ text: "一行目\n二行目  " })).toBe("一行目 二行目");
	});

	it("prefers shared content over add", () => {
		expect(quickAddText({ add: "", text: "共有" })).toBe("共有");
	});
});
