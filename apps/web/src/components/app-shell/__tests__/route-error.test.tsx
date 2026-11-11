import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const invalidate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
	useRouter: () => ({ invalidate }),
}));

import { RouteError, RouteNotFound } from "../route-error";

describe("route fallbacks", () => {
	it("offers a retry and the way home after an error", async () => {
		const reset = vi.fn();
		render(<RouteError error={new Error("boom")} reset={reset} />);

		expect(screen.getByRole("alert")).toHaveTextContent("表示できませんでした");
		expect(screen.getByRole("link", { name: "今日に戻る" })).toHaveAttribute(
			"href",
			"/"
		);
		await userEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
		expect(reset).toHaveBeenCalledOnce();
		expect(invalidate).toHaveBeenCalledOnce();
	});

	it("leads home from an unknown address", () => {
		render(<RouteNotFound />);

		expect(screen.getByText("ページが見つかりません")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "今日に戻る" })).toHaveAttribute(
			"href",
			"/"
		);
	});
});
