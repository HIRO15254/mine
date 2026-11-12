import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"apps/web/vitest.dom.config.ts",
			"apps/web/vitest.node.config.ts",
			"apps/server/vitest.config.ts",
			"packages/api/vitest.config.ts",
			"packages/auth/vitest.config.ts",
			"packages/db/vitest.config.ts",
			"packages/env/vitest.config.ts",
			"scripts/vitest.config.ts",
		],
		coverage: {
			provider: "istanbul",
			include: [
				"apps/*/src/**/*.{ts,tsx}",
				"packages/*/src/**/*.ts",
				"scripts/*.ts",
			],
			exclude: [
				"**/__tests__/**",
				"packages/*/src/testing.ts",
				"**/*.test.{ts,tsx}",
				"**/*.d.ts",
				"**/routeTree.gen.ts",
				"**/migrations/**",
			],
			reporter: ["text-summary", "json-summary", "html", "lcov"],
			// A floor for each part, about three points under where it stood on
			// 2026-11-12. It catches a feature that lands without tests; raise
			// it when coverage has clearly moved up, never lower it to pass.
			thresholds: {
				"apps/server/src/**": {
					branches: 75,
					functions: 86,
					lines: 88,
					statements: 88,
				},
				"apps/web/src/**": {
					branches: 68,
					functions: 67,
					lines: 76,
					statements: 76,
				},
				"packages/api/src/**": {
					branches: 89,
					functions: 95,
					lines: 94,
					statements: 94,
				},
				"packages/db/src/**": { functions: 91, lines: 93, statements: 93 },
			},
		},
	},
});
