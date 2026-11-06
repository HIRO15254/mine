import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/trpc-mock"));

import { renderWithQuery } from "../../../__tests__/render";
import { trpcMock } from "../../../__tests__/trpc-mock";
import { ConsentCard } from "../consent-card";

const CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const request = {
	clientId: "client-1",
	codeChallenge: "c".repeat(43),
	redirectUri: CLAUDE,
	state: "st",
};

afterEach(() => {
	trpcMock.state.client = { name: "Claude", redirectHost: "claude.ai" };
	trpcMock.calls.approve.mockClear();
});

describe("ConsentCard", () => {
	it("approves and returns to the app with a code", async () => {
		const navigate = vi.fn();
		renderWithQuery(<ConsentCard navigate={navigate} request={request} />);

		expect(await screen.findByText("Claude を接続")).toBeInTheDocument();
		expect(screen.getByText("claude.ai")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "許可" }));

		expect(trpcMock.calls.approve).toHaveBeenCalledWith(
			expect.objectContaining({
				clientId: "client-1",
				codeChallenge: request.codeChallenge,
				redirectUri: CLAUDE,
				state: "st",
			}),
			expect.anything()
		);
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith(`${CLAUDE}?code=c`)
		);
	});

	it("declines with access_denied", async () => {
		const navigate = vi.fn();
		renderWithQuery(<ConsentCard navigate={navigate} request={request} />);

		await userEvent.click(await screen.findByRole("button", { name: "拒否" }));
		expect(navigate).toHaveBeenCalledWith(
			`${CLAUDE}?error=access_denied&state=st`
		);
		expect(trpcMock.calls.approve).not.toHaveBeenCalled();
	});

	it("refuses unknown clients and unsupported requests", async () => {
		trpcMock.state.client = null;
		const { unmount } = renderWithQuery(<ConsentCard request={request} />);
		expect(
			await screen.findByText(
				"このアプリは登録されていないか、戻り先が違います"
			)
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "許可" })).toBeNull();
		unmount();

		renderWithQuery(
			<ConsentCard
				request={{ error: "このアプリの接続方式には対応していません" }}
			/>
		);
		expect(
			screen.getByText("このアプリの接続方式には対応していません")
		).toBeInTheDocument();
	});
});
