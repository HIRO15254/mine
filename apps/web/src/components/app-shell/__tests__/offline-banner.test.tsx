import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfflineBanner } from "../offline-banner";

function setOnline(online: boolean) {
	vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
	window.dispatchEvent(new Event(online ? "online" : "offline"));
}

describe("OfflineBanner", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("shows only while the browser is offline", () => {
		setOnline(true);
		render(<OfflineBanner />);
		expect(screen.queryByRole("status")).not.toBeInTheDocument();

		act(() => setOnline(false));
		expect(screen.getByRole("status")).toHaveTextContent("オフラインです");

		act(() => setOnline(true));
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});
});
