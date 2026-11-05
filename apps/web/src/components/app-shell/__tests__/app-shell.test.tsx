import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		...props
	}: {
		children: React.ReactNode;
		to: string;
	}) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
	useRouterState: ({ select }: { select: (s: unknown) => string }) =>
		select({ location: { pathname: "/tasks" } }),
}));

import { AppShell } from "../app-shell";

describe("AppShell", () => {
	it("marks the current section in both navigations", () => {
		render(
			<AppShell>
				<p>content</p>
			</AppShell>
		);

		const current = screen.getAllByRole("link", { current: "page" });
		expect(current).toHaveLength(2);
		for (const link of current) {
			expect(link).toHaveTextContent("タスク");
		}
		expect(screen.getByText("content")).toBeInTheDocument();
	});
});
