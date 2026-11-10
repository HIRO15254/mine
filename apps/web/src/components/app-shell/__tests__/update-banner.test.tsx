import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { pwaState } from "../../../__tests__/pwa-register";
import { UpdateBanner } from "../update-banner";

describe("UpdateBanner", () => {
	beforeEach(() => {
		pwaState.update.mockClear();
		pwaState.waiting = false;
	});

	it("stays hidden while no new version is waiting", () => {
		render(<UpdateBanner />);
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("reloads into the waiting version", async () => {
		pwaState.waiting = true;
		render(<UpdateBanner />);

		expect(screen.getByRole("status")).toHaveTextContent(
			"新しいバージョンがあります"
		);
		await userEvent.click(screen.getByRole("button", { name: "更新" }));
		expect(pwaState.update).toHaveBeenCalledWith(true);
	});

	it("can be put off until later", async () => {
		pwaState.waiting = true;
		render(<UpdateBanner />);

		await userEvent.click(screen.getByRole("button", { name: "あとで" }));
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});
});
