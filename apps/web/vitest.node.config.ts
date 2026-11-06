import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
	test: {
		name: "web-node",
		environment: "node",
		// Calendar helpers format in local time; pin it so results are stable.
		env: { TZ: "Asia/Tokyo" },
		include: ["src/**/*.test.ts"],
	},
});
