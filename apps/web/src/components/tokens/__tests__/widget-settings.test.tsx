import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => import("../../../__tests__/test-api"));
vi.mock("@mine/env/web", () => ({
	env: { VITE_SERVER_URL: "https://api.example.test" },
}));

import { renderWithQuery, useDesktopLayout } from "../../../__tests__/render";
import { api } from "../../../__tests__/test-api";
import { WidgetSettings } from "../widget-settings";

const URL_PREFIX = "https://api.example.test/widget/mine_wg_";

describe("WidgetSettings", () => {
	beforeEach(() => api.reset());

	it("issues a link once, replaces it and takes it away", async () => {
		useDesktopLayout();
		renderWithQuery(<WidgetSettings />);

		await userEvent.click(
			await screen.findByRole("button", { name: "URL を発行" })
		);
		const field = await screen.findByLabelText("ウィジェットの URL");
		const first = (field as HTMLInputElement).value;
		expect(first.startsWith(URL_PREFIX)).toBe(true);
		const saved = await api.caller.widget.link();
		expect(first).toContain(saved?.prefix ?? "?");
		expect(
			await screen.findByText("まだありません", { exact: false })
		).toBeInTheDocument();

		const writeText = vi.fn(() => Promise.resolve());
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		await userEvent.click(screen.getByRole("button", { name: "コピー" }));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(first));
		expect(
			screen.getByRole("button", { name: "コピーしました" })
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "URL を再発行" }));
		await waitFor(() =>
			expect(screen.getByLabelText("ウィジェットの URL")).not.toHaveValue(first)
		);

		await userEvent.click(screen.getByRole("button", { name: "削除" }));
		await userEvent.click(
			screen.getByRole("button", { name: "もう一度押して削除" })
		);
		await waitFor(() =>
			expect(screen.queryByLabelText("ウィジェットの URL")).toBeNull()
		);
		await expect(api.caller.widget.link()).resolves.toBeNull();
		expect(
			await screen.findByRole("button", { name: "URL を発行" })
		).toBeInTheDocument();
	});
});
