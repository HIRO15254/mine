import {
	defineConfig,
	minimal2023Preset as preset,
} from "@vite-pwa/assets-generator/config";

export default defineConfig({
	headLinkOptions: {
		preset: "2023",
	},
	// The logo already sits on the app's dark background. Only the maskable
	// icon needs room, so Android's round mask keeps the star and the ring.
	preset: {
		...preset,
		transparent: { ...preset.transparent, padding: 0 },
		maskable: {
			...preset.maskable,
			padding: 0.15,
			resizeOptions: { background: "#08090a" },
		},
		apple: {
			...preset.apple,
			padding: 0,
			resizeOptions: { background: "#08090a" },
		},
	},
	images: ["public/logo.png"],
});
