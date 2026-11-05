import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "web-node",
		environment: "node",
		// Calendar helpers format in local time; pin it so results are stable.
		env: { TZ: "Asia/Tokyo" },
		include: ["src/**/*.test.ts"],
	},
});
