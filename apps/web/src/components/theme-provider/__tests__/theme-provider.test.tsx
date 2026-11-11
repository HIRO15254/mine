import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "../theme-provider";

const themeColor = () =>
	document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;

describe("ThemeProvider", () => {
	afterEach(() => {
		document.documentElement.removeAttribute("class");
		document.documentElement.style.removeProperty("--background");
		document.querySelector('meta[name="theme-color"]')?.remove();
	});

	it("gives the browser the background of the theme now on the page", async () => {
		window.matchMedia = ((query: string) => ({
			addEventListener: () => undefined,
			addListener: () => undefined,
			matches: false,
			media: query,
			removeEventListener: () => undefined,
			removeListener: () => undefined,
		})) as unknown as typeof window.matchMedia;
		const root = document.documentElement;
		root.style.setProperty("--background", "#f6f7f9");
		render(
			<ThemeProvider attribute="class" defaultTheme="light">
				<p>content</p>
			</ThemeProvider>
		);
		await waitFor(() => expect(themeColor()).toBe("#f6f7f9"));

		// What next-themes does on a switch: the class and tokens change after
		// the theme's name has.
		root.classList.add("dark");
		root.style.setProperty("--background", "#060709");

		await waitFor(() => expect(themeColor()).toBe("#060709"));
	});
});
