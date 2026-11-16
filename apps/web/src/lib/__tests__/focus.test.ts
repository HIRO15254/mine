import { focusManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { refetchOnWindowFocus } from "../focus";

describe("refetchOnWindowFocus", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("tells React Query when the window gets the focus back", () => {
		const target = new EventTarget();
		vi.stubGlobal("window", target);
		const focused = vi.fn();
		const unsubscribe = focusManager.subscribe(focused);
		refetchOnWindowFocus();

		target.dispatchEvent(new Event("focus"));
		target.dispatchEvent(new Event("visibilitychange"));
		unsubscribe();

		expect(focused).toHaveBeenCalledTimes(2);
	});
});
