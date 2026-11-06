import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/trpc-mock"));
vi.mock("@mine/env/web", () => ({
	env: { VITE_SERVER_URL: "https://api.example.test" },
}));

import { renderWithQuery, useDesktopLayout } from "../../../__tests__/render";
import { trpcMock } from "../../../__tests__/trpc-mock";
import { ApiTokenSettings } from "../api-token-settings";

const NAME = /名前/;

describe("ApiTokenSettings", () => {
	it("lists tokens and shows a new token once", async () => {
		useDesktopLayout();
		trpcMock.state.tokens = [
			{
				createdAt: "2026-11-01T00:00:00.000Z",
				id: "old",
				lastUsedAt: null,
				name: "Tasker",
				prefix: "mine_zzzzzz",
			},
		];
		renderWithQuery(<ApiTokenSettings />);

		expect(await screen.findByText("Tasker")).toBeInTheDocument();
		expect(screen.getByText("https://api.example.test/v1")).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole("button", { name: "トークンを発行" })
		);
		await userEvent.click(screen.getByRole("button", { name: "発行" }));
		expect(screen.getByText("名前を入力してください")).toBeInTheDocument();

		await userEvent.type(screen.getByLabelText(NAME), "HTTP Shortcuts");
		await userEvent.click(screen.getByRole("button", { name: "発行" }));

		await waitFor(() =>
			expect(screen.getByLabelText("発行したトークン")).toHaveValue(
				"mine_abcdef-secret"
			)
		);
		expect(trpcMock.calls.tokenCreate).toHaveBeenCalledWith(
			{ name: "HTTP Shortcuts" },
			expect.anything()
		);
	});
});
