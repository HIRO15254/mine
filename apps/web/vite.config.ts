import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const NOTO_SANS_JP_ASSET = /\/assets\/noto-sans-jp-.*\.woff2$/;

export default defineConfig({
	plugins: [
		tailwindcss(),
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		react(),
		VitePWA({
			// A new deploy waits until the person taps 更新 (UpdateBanner).
			registerType: "prompt",
			injectRegister: false,
			manifest: {
				id: "/",
				name: "Mine",
				short_name: "Mine",
				description: "予定・タスク・時間の記録をひとつに",
				theme_color: "#060709",
				background_color: "#060709",
				lang: "ja",
				categories: ["productivity"],
				shortcuts: [
					{
						name: "タスクを追加",
						short_name: "追加",
						url: "/tasks?add=",
						icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
					},
					{
						name: "時間の記録",
						short_name: "記録",
						url: "/time",
						icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
					},
				],
				// Android's share sheet opens the task box with the shared text.
				share_target: {
					action: "/tasks",
					method: "GET",
					params: { title: "title", text: "text", url: "url" },
				},
			},
			pwaAssets: { disabled: false, config: true },
			workbox: {
				// The Mine mark and the Latin subset of the digits' font are on every
				// screen, so they are there for an offline start. Noto Sans JP is
				// 120-odd subsets and is cached as each is first used.
				globPatterns: [
					"**/*.{js,css,html}",
					"logo.png",
					"assets/jetbrains-mono-latin-wght-*.woff2",
				],
				globIgnores: ["**/noto-sans-jp-*.woff2"],
				runtimeCaching: [
					{
						urlPattern: NOTO_SANS_JP_ASSET,
						handler: "CacheFirst",
						options: {
							cacheName: "noto-sans-jp",
							cacheableResponse: { statuses: [200] },
							expiration: { maxEntries: 128, maxAgeSeconds: 31_536_000 },
						},
					},
				],
			},
		}),
	],
	resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
	server: { port: 3001 },
});
