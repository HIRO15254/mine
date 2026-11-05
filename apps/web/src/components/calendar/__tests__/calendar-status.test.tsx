import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { signInSocial } = vi.hoisted(() => ({
	signInSocial: vi.fn(() => Promise.resolve({ error: null })),
}));
vi.mock("@/lib/auth-client", () => ({
	authClient: { signIn: { social: signInSocial } },
}));

import { CalendarError, isCalendarNotConnected } from "../calendar-status";

describe("CalendarError", () => {
	it("recognizes the not-connected error", () => {
		expect(
			isCalendarNotConnected(new Error("GOOGLE_CALENDAR_NOT_CONNECTED"))
		).toBe(true);
		expect(isCalendarNotConnected(new Error("boom"))).toBe(false);
		expect(isCalendarNotConnected("GOOGLE_CALENDAR_NOT_CONNECTED")).toBe(false);
	});

	it("offers to connect Google Calendar", async () => {
		render(
			<CalendarError
				error={new Error("GOOGLE_CALENDAR_NOT_CONNECTED")}
				onRetry={vi.fn()}
			/>
		);

		await userEvent.click(
			screen.getByRole("button", { name: "カレンダーを連携" })
		);

		expect(signInSocial).toHaveBeenCalledWith(
			expect.objectContaining({ provider: "google" })
		);
	});

	it("offers a retry for other failures", async () => {
		const onRetry = vi.fn();
		render(<CalendarError error={new Error("boom")} onRetry={onRetry} />);

		await userEvent.click(screen.getByRole("button", { name: "再読み込み" }));

		expect(onRetry).toHaveBeenCalledOnce();
	});
});
