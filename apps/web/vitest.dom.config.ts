import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": new URL("./src", import.meta.url).pathname,
			// The PWA plugin is not loaded in tests; this stands in for it.
			"virtual:pwa-register/react": new URL(
				"./src/__tests__/pwa-register.ts",
				import.meta.url
			).pathname,
		},
	},
	test: {
		name: "web-dom",
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup.ts"],
		include: ["src/**/*.test.tsx"],
	},
});
