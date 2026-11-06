import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type * as React from "react";
import { useEffect } from "react";

/** Keeps the browser and status bar color in step with the chosen theme. */
function ThemeColor() {
	const { resolvedTheme } = useTheme();
	useEffect(() => {
		if (!resolvedTheme) {
			return;
		}
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
		meta.content = color;
	}, [resolvedTheme]);
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
