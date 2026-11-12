import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/test-api"));
vi.mock("@mine/env/web", () => ({
	env: { VITE_SERVER_URL: "https://api.example.test" },
}));

import { renderWithQuery, useDesktopLayout } from "../../../__tests__/render";
import { api } from "../../../__tests__/test-api";
import { ApiTokenSettings } from "../api-token-settings";

const NAME = /名前/;

describe("ApiTokenSettings", () => {
	beforeEach(() => api.reset());

	it("lists tokens and shows a new token once", async () => {
		useDesktopLayout();
		await api.caller.token.create({ name: "Tasker" });
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

		const field = await screen.findByLabelText("発行したトークン");
		const issued = (field as HTMLInputElement).value;
		// The server keeps the hash and the first characters, never the token.
		const [saved] = (await api.caller.token.list()).filter(
			(token) => token.name === "HTTP Shortcuts"
		);
		expect(saved).toBeDefined();
		expect(issued.startsWith(saved?.prefix ?? "?")).toBe(true);
		expect(issued.length).toBeGreaterThan(saved?.prefix.length ?? 0);

		// A browser that refuses the clipboard must not break the sheet.
		const writeText = vi.fn(() => Promise.reject(new Error("denied")));
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		await userEvent.click(screen.getByRole("button", { name: "コピー" }));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(issued));
		expect(screen.getByRole("button", { name: "コピー" })).toBeInTheDocument();
		expect(screen.getByLabelText("発行したトークン")).toHaveValue(issued);
	});
});
