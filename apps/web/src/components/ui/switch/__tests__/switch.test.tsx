import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "../switch";

describe("Switch", () => {
	it("toggles and reports the new state", async () => {
		const onCheckedChange = vi.fn();
		render(
			<Switch aria-label="祝日" onCheckedChange={onCheckedChange} size="xl" />
		);

		const control = screen.getByRole("switch", { name: "祝日" });
		expect(control).toHaveAttribute("data-size", "xl");
		await userEvent.click(control);

		expect(onCheckedChange).toHaveBeenCalledWith(true);
		expect(control).toHaveAttribute("data-state", "checked");
	});
});
