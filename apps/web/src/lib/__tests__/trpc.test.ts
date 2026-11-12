import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mine/env/web", () => ({
	env: { VITE_SERVER_URL: "https://api.example.test" },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { toast } from "sonner";

import { queryClient } from "../trpc";

function run(options: {
	mutationFn: () => Promise<unknown>;
	onError?: () => void;
}) {
	return queryClient
		.getMutationCache()
		.build(queryClient, options)
		.execute(undefined)
		.catch(() => undefined);
}

describe("queryClient", () => {
	afterEach(() => {
		onlineManager.setOnline(true);
		vi.mocked(toast.error).mockClear();
	});

	it("fails a write at once while offline instead of holding it", async () => {
		onlineManager.setOnline(false);
		const mutationFn = vi.fn(() =>
			Promise.reject(new Error("Failed to fetch"))
		);

		await run({ mutationFn });

		expect(mutationFn).toHaveBeenCalledOnce();
	});

	it("reports a failed write that has no error handling of its own", async () => {
		const mutationFn = () => Promise.reject(new Error("refused"));

		await run({ mutationFn });
		expect(toast.error).toHaveBeenCalledWith("保存できませんでした");

		vi.mocked(toast.error).mockClear();
		const onError = vi.fn();
		await run({ mutationFn, onError });
		expect(onError).toHaveBeenCalledOnce();
		expect(toast.error).not.toHaveBeenCalled();
	});
});
