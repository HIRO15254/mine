import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("../auth-client", () => ({
	authClient: { getSession: (...args: unknown[]) => getSession(...args) },
}));

import { checkSession, forgetSession } from "../session";

const user = { email: "me@example.com", id: "u1", name: "Me" };
const MINUTE = 60_000;

describe("checkSession", () => {
	beforeEach(() => {
		getSession.mockReset();
		forgetSession();
	});

	it("tells signed in, signed out and no answer apart", async () => {
		getSession.mockResolvedValueOnce({ data: { user }, error: null });
		await expect(checkSession()).resolves.toEqual({ state: "signed-in", user });
		forgetSession();

		getSession.mockResolvedValueOnce({ data: null, error: null });
		await expect(checkSession()).resolves.toEqual({ state: "signed-out" });

		getSession.mockResolvedValueOnce({ data: null, error: { status: 503 } });
		await expect(checkSession()).resolves.toEqual({ state: "unknown" });

		getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		await expect(checkSession()).resolves.toEqual({ state: "unknown" });
	});

	it("asks again only after a few minutes or a sign-out", async () => {
		getSession.mockResolvedValue({ data: { user }, error: null });
		const start = Date.UTC(2026, 10, 11);

		await checkSession(start);
		await checkSession(start + 4 * MINUTE);
		expect(getSession).toHaveBeenCalledTimes(1);

		await checkSession(start + 6 * MINUTE);
		expect(getSession).toHaveBeenCalledTimes(2);

		forgetSession();
		await checkSession(start + 7 * MINUTE);
		expect(getSession).toHaveBeenCalledTimes(3);
	});

	it("gives up waiting instead of holding the screen", async () => {
		getSession.mockResolvedValueOnce({ data: null, error: null });
		await checkSession();

		const [options] = getSession.mock.calls[0] as [
			{ fetchOptions: { signal: AbortSignal } },
		];
		expect(options.fetchOptions.signal).toBeInstanceOf(AbortSignal);
	});
});
