import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
	cleanup();
});

// Radix measures some controls (e.g. Switch); jsdom has no ResizeObserver.
if (!("ResizeObserver" in globalThis)) {
	globalThis.ResizeObserver = class {
		disconnect() {
			// jsdom never resizes
		}
		observe() {
			// jsdom never resizes
		}
		unobserve() {
			// jsdom never resizes
		}
	};
}
