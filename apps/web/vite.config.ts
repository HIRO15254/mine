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
			registerType: "autoUpdate",
			manifest: {
				id: "/",
				name: "Mine",
				short_name: "Mine",
				description: "予定・タスク・時間の記録をひとつに",
				theme_color: "#08090a",
				background_color: "#08090a",
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
