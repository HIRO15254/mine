import { defineConfig } from "vitest/config";

/**
 * The browser smoke test. It is not one of the root config's projects, so
 * `bun run verify` and the deploy do not run it (they have no browser); run
 * it with `bun run smoke`.
 */
export default defineConfig({
	test: {
		name: "smoke",
		environment: "node",
		fileParallelism: false,
		hookTimeout: 120_000,
		include: ["*.e2e.ts"],
		root: import.meta.dirname,
		testTimeout: 60_000,
	},
});
