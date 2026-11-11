import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";
import { useEffect } from "react";

/** Puts the page background in the browser's theme-color meta. */
function syncThemeColor() {
	const color = getComputedStyle(document.documentElement)
		.getPropertyValue("--background")
		.trim();
	if (!color) {
		return;
	}
	let meta = document.querySelector<HTMLMetaElement>(
		'meta[name="theme-color"]'
	);
	if (!meta) {
		meta = document.createElement("meta");
		meta.name = "theme-color";
		document.head.append(meta);
	}
	if (meta.content !== color) {
		meta.content = color;
	}
}

/**
 * Keeps the browser and status bar color in step with the theme. next-themes
 * switches the class on <html> in an effect of its own that runs after this
 * component's, so the color is read when the class changes, not when the
 * theme's name does (which gave the previous theme's color).
 */
function ThemeColor() {
	useEffect(() => {
		syncThemeColor();
		const observer = new MutationObserver(syncThemeColor);
		observer.observe(document.documentElement, {
			attributeFilter: ["class", "style"],
		});
		return () => observer.disconnect();
	}, []);
	return null;
}

export function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	return (
		<NextThemesProvider {...props}>
			<ThemeColor />
			{children}
		</NextThemesProvider>
	);
}
